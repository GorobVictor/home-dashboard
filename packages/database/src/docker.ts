import type { DockerObservation } from "@home-dashboard/docker-monitoring";
import type { Prisma } from "../generated/client/client";
import { getDatabase } from "./client";
import { lockEventKey, observeEventInTransaction, publishEventInTransaction } from "./events";

const bytes = (value: bigint | null | undefined) => value ?? null;
const now = () => new Date();
export type DockerSettingsInput = { enabled: boolean; pollIntervalSeconds: number; stoppedAlertsEnabled: boolean; unhealthyAlertsEnabled: boolean };

export async function getDockerMonitoringSettings() {
  return getDatabase().dockerMonitoringSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
}
export async function updateDockerMonitoringSettings(input: DockerSettingsInput) {
  return getDatabase().dockerMonitoringSettings.upsert({ where: { id: "default" }, create: { id: "default", ...input }, update: input });
}

async function observeAfterTwoSamples(tx: Prisma.TransactionClient, key: string, bad: boolean, raise: Parameters<typeof publishEventInTransaction>[1] | null, recovery: Parameters<typeof publishEventInTransaction>[1], sampledAt: Date) {
  await lockEventKey(tx, key);
  const previous = await tx.eventState.findUnique({ where: { key } });
  if (!previous) { await tx.eventState.create({ data: { key, value: bad ? "candidate" : "normal", failures: bad ? 1 : 0 } }); return; }
  if (bad) {
    const failures = Math.min(2, previous.failures + 1);
    if (failures >= 2 && previous.value !== "alert" && raise && (!previous.lastEventAt || sampledAt.getTime() - previous.lastEventAt.getTime() >= 60_000)) {
      await publishEventInTransaction(tx, raise);
      await tx.eventState.update({ where: { key }, data: { value: "alert", failures, lastEventAt: sampledAt } });
    } else await tx.eventState.update({ where: { key }, data: { failures } });
    return;
  }
  if (previous.value === "alert") {
    await publishEventInTransaction(tx, recovery);
    await tx.eventState.update({ where: { key }, data: { value: "normal", failures: 0, lastEventAt: sampledAt } });
  } else await tx.eventState.update({ where: { key }, data: { value: "normal", failures: 0 } });
}

async function observeDockerState(tx: Prisma.TransactionClient, observation: DockerObservation, intentionalStop: boolean, alerts: { stopped: boolean; unhealthy: boolean }, sampledAt: Date) {
  const { container } = observation;
  const stopped = container.state === "exited" || container.state === "dead";
  const unhealthy = container.health === "unhealthy";
  await observeEventInTransaction(tx, `docker-state:${container.id}`, container.state, { source: "docker", type: "docker.container_state_changed", severity: "info", title: `Docker ${container.name}: ${container.state}`, payload: { containerId: container.id, name: container.name, state: container.state }, occurredAt: sampledAt, telegram: false, userIds: [] });
  await observeAfterTwoSamples(tx, `docker-stopped:${container.id}`, stopped && !intentionalStop, stopped && !intentionalStop && alerts.stopped ? { source: "docker", type: "docker.container_stopped", severity: "warning", title: `Docker ${container.name}: контейнер зупинено`, payload: { containerId: container.id, name: container.name, state: container.state }, occurredAt: sampledAt } : null, { source: "docker", type: "docker.container_started", severity: "info", title: `Docker ${container.name}: контейнер запущено`, payload: { containerId: container.id, name: container.name }, occurredAt: sampledAt }, sampledAt);
  await observeAfterTwoSamples(tx, `docker-health:${container.id}`, unhealthy, unhealthy && alerts.unhealthy ? { source: "docker", type: "docker.container_unhealthy", severity: "warning", title: `Docker ${container.name}: unhealthy`, payload: { containerId: container.id, name: container.name }, occurredAt: sampledAt } : null, { source: "docker", type: "docker.container_healthy", severity: "info", title: `Docker ${container.name}: health відновлено`, payload: { containerId: container.id, name: container.name }, occurredAt: sampledAt }, sampledAt);
}

export async function saveDockerObservation(observation: DockerObservation, sampledAt = now()) {
  const db = getDatabase();
  const settings = await getDockerMonitoringSettings();
  const activeStop = await db.dockerAction.findFirst({ where: { containerId: observation.container.id, action: "stop", status: { in: ["accepted", "executing"] }, createdAt: { gt: new Date(sampledAt.getTime() - 2 * 60_000) } }, select: { id: true } });
  await db.$transaction(async (tx) => {
    await tx.dockerEngine.upsert({ where: { id: "default" }, create: { id: "default", lastSeenAt: sampledAt, lastError: null }, update: { lastSeenAt: sampledAt, lastError: null } });
    const c = observation.container;
    await tx.dockerContainer.upsert({ where: { id: c.id }, create: { id: c.id, name: c.name, image: c.image, state: c.state, health: c.health, composeProject: c.composeProject, composeService: c.composeService, createdAtDocker: c.createdAt, startedAt: c.startedAt, finishedAt: c.finishedAt, exitCode: c.exitCode, restartCount: c.restartCount, lastSeenAt: sampledAt }, update: { name: c.name, image: c.image, state: c.state, health: c.health, composeProject: c.composeProject, composeService: c.composeService, createdAtDocker: c.createdAt, startedAt: c.startedAt, finishedAt: c.finishedAt, exitCode: c.exitCode, restartCount: c.restartCount, lastSeenAt: sampledAt, missingSince: null } });
    if (observation.metrics) await tx.dockerMetric.create({ data: { containerId: c.id, sampledAt, cpuPercent: observation.metrics.cpuPercent, memoryUsageBytes: bytes(observation.metrics.memoryUsageBytes), memoryWorkingSetBytes: bytes(observation.metrics.memoryWorkingSetBytes), memoryLimitBytes: bytes(observation.metrics.memoryLimitBytes), memoryPercent: observation.metrics.memoryPercent, networkRxBytes: bytes(observation.metrics.networkRxBytes), networkTxBytes: bytes(observation.metrics.networkTxBytes), networkRxPerSecond: observation.metrics.networkRxPerSecond, networkTxPerSecond: observation.metrics.networkTxPerSecond, blockReadBytes: bytes(observation.metrics.blockReadBytes), blockWriteBytes: bytes(observation.metrics.blockWriteBytes), pids: observation.metrics.pids } });
    await observeDockerState(tx, observation, Boolean(activeStop), { stopped: settings.stoppedAlertsEnabled, unhealthy: settings.unhealthyAlertsEnabled }, sampledAt);
    await tx.$executeRaw`SELECT pg_notify('home_dashboard_events', ${JSON.stringify({ type: "docker.snapshot.saved", containerId: c.id, sampledAt: sampledAt.toISOString() })})`;
  });
}

export async function markDockerUnavailable() {
  await getDatabase().$transaction(async (tx) => {
    await tx.dockerEngine.upsert({ where: { id: "default" }, create: { id: "default", lastError: "docker_unavailable" }, update: { lastError: "docker_unavailable" } });
  });
}

export async function markMissingDockerContainers(ids: string[], seenAt = now()) {
  await getDatabase().dockerContainer.updateMany({ where: { lastSeenAt: { lt: seenAt }, id: { notIn: ids } }, data: { missingSince: seenAt } });
}

export async function listDockerContainers(page = 1, query = "", state?: string) {
  const db = getDatabase(); const where = { ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { image: { contains: query, mode: "insensitive" as const } }] } : {}), ...(state ? { state } : {}) };
  const [items, total] = await Promise.all([db.dockerContainer.findMany({ where, orderBy: [{ name: "asc" }], skip: (page - 1) * 30, take: 30, include: { metrics: { orderBy: { sampledAt: "desc" }, take: 1 }, actions: { orderBy: { createdAt: "desc" }, take: 1 } } }), db.dockerContainer.count({ where })]);
  return { items, total, page, pageSize: 30 };
}
export async function getDockerStatus() {
  const [engine, settings, total, running, unhealthy] = await Promise.all([getDatabase().dockerEngine.findUnique({ where: { id: "default" } }), getDockerMonitoringSettings(), getDatabase().dockerContainer.count(), getDatabase().dockerContainer.count({ where: { state: "running" } }), getDatabase().dockerContainer.count({ where: { health: "unhealthy" } })]);
  return { engine, settings, total, running, unhealthy };
}
export async function listDockerHistory(containerId: string, hours: number) {
  const since = new Date(Date.now() - hours * 3_600_000); const raw = hours <= 24 ? await getDatabase().dockerMetric.findMany({ where: { containerId, sampledAt: { gte: since } }, orderBy: { sampledAt: "asc" } }) : await getDatabase().dockerMetricRollup.findMany({ where: { containerId, bucketAt: { gte: since } }, orderBy: { bucketAt: "asc" } });
  const normalized = raw.map((point) => "sampledAt" in point ? point : { ...point, sampledAt: point.bucketAt });
  const points = normalized.length > 400 ? normalized.filter((_, index) => index % Math.ceil(normalized.length / 400) === 0) : normalized;
  return points;
}
export async function createDockerAction(userId: string, containerId: string, action: "start" | "stop", requestId: string) {
  const db = getDatabase();
  const previous = await db.dockerAction.findUnique({ where: { userId_requestId: { userId, requestId } } });
  if (previous) { if (previous.containerId !== containerId || previous.action !== action) throw new Error("request_conflict"); return previous; }
  const active = await db.dockerAction.count({ where: { containerId, status: { in: ["accepted", "executing"] } } }); if (active) throw new Error("container_busy");
  const recent = await db.dockerAction.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 60_000) } } }); if (recent >= 10) throw new Error("rate_limited");
  return db.dockerAction.create({ data: { userId, containerId, action, requestId, status: "accepted" } });
}
export async function updateDockerAction(id: string, status: "executing" | "succeeded" | "failed" | "unknown", errorCode?: string) {
  return getDatabase().$transaction(async (tx) => { const action = await tx.dockerAction.update({ where: { id }, data: { status, errorCode, ...(status === "succeeded" || status === "failed" || status === "unknown" ? { finishedAt: now() } : {}) } }); await tx.$executeRaw`SELECT pg_notify('home_dashboard_events', ${JSON.stringify({ type: "docker.action.changed", actionId: id })})`; return action; });
}
export async function getDockerAction(id: string) { return getDatabase().dockerAction.findUnique({ where: { id } }); }
export async function listDockerActions(page = 1) { const db = getDatabase(); const [items, total] = await Promise.all([db.dockerAction.findMany({ orderBy: { createdAt: "desc" }, take: 30, skip: (page - 1) * 30, include: { container: { select: { name: true } }, user: { select: { login: true } } } }), db.dockerAction.count()]); return { items, total, page, pageSize: 30 }; }
export async function rollupDockerMetrics() { await getDatabase().$executeRaw`
  INSERT INTO docker_metric_rollups (container_id, bucket_at, cpu_percent, memory_working_set_bytes, network_rx_per_second, network_tx_per_second)
  SELECT container_id, to_timestamp(floor(extract(epoch FROM sampled_at) / 300) * 300), avg(cpu_percent), avg(memory_working_set_bytes)::bigint, avg(network_rx_per_second), avg(network_tx_per_second)
  FROM docker_metrics WHERE sampled_at < now() - interval '5 minutes' GROUP BY 1, 2 ON CONFLICT (container_id, bucket_at) DO NOTHING`;
}
export async function pruneDockerMonitoring() { const db = getDatabase(); const [metrics, rollups, actions, containers] = await Promise.all([db.dockerMetric.deleteMany({ where: { sampledAt: { lt: new Date(Date.now() - 7 * 864e5) } } }), db.dockerMetricRollup.deleteMany({ where: { bucketAt: { lt: new Date(Date.now() - 90 * 864e5) } } }), db.dockerAction.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 864e5) } } }), db.dockerContainer.deleteMany({ where: { missingSince: { lt: new Date(Date.now() - 90 * 864e5) } } })]); return metrics.count + rollups.count + actions.count + containers.count; }
