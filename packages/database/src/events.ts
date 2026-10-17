import type { Prisma } from "../generated/client/client";
import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "./client";
import { acceptsSeverity, shouldPublish, batteryState, type Severity } from "./event-policy";

export interface EventInput {
  source: string;
  type: string;
  severity: Severity;
  title: string;
  payload?: Prisma.InputJsonObject;
  occurredAt?: Date;
  deduplicationKey?: string;
  deduplicationWindowMs?: number;
  telegram?: boolean;
  channelId?: string;
  userIds?: string[];
  channelIds?: string[];
}
export type EventTransaction = Prisma.TransactionClient;

export async function notifyChanged(tx: EventTransaction) {
  await tx.$executeRaw`SELECT pg_notify('home_dashboard_events', '{"type":"notifications.changed"}')`;
}

// Serializes publication/observation by key in the same database transaction.
export async function lockEventKey(tx: EventTransaction, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export async function publishEventInTransaction(tx: EventTransaction, input: EventInput) {
  if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(input.source) || !/^[a-z][a-z0-9_.-]{0,99}$/.test(input.type) || !input.title || input.title.length > 500 || (input.deduplicationKey?.length ?? 0) > 255) throw new Error("invalid_event");
  const serialized = JSON.stringify(input.payload ?? {});
  if (Buffer.byteLength(serialized) > 4096 || /"[^" ]*(?:token|password|secret|authorization|credential)[^" ]*"\s*:/i.test(serialized)) throw new Error("unsafe_event_payload");
  const windowMs = input.deduplicationWindowMs ?? 0;
  if (!Number.isSafeInteger(windowMs) || windowMs < 0 || windowMs > 90 * 864e5 || (windowMs && !input.deduplicationKey)) throw new Error("invalid_deduplication_window");
  let dedupStateKey: string | undefined;
  if (input.deduplicationKey) {
    await lockEventKey(tx, `event:${input.deduplicationKey}`);
    dedupStateKey = windowMs ? `dedup:${createHash("sha256").update(input.deduplicationKey).digest("hex")}` : undefined;
    const state = dedupStateKey ? await tx.eventState.findUnique({ where: { key: dedupStateKey } }) : null;
    const existing = state && state.lastEventAt && Date.now() - state.lastEventAt.getTime() < windowMs ? await tx.event.findUnique({ where: { id: state.value } }) : !windowMs ? await tx.event.findUnique({ where: { deduplicationKey: input.deduplicationKey } }) : null;
    if (existing) return existing;
  }
  const { telegram = true, channelId, userIds, channelIds, deduplicationWindowMs: _window, ...data } = input;
  void _window;
  if (windowMs) data.deduplicationKey = `${input.deduplicationKey!.slice(0, 210)}:${randomUUID()}`;
  const event = await tx.event.create({ data: { ...data, payload: input.payload ?? {} } });
  if (dedupStateKey) await tx.eventState.upsert({ where: { key: dedupStateKey }, create: { key: dedupStateKey, value: event.id, lastEventAt: new Date() }, update: { value: event.id, lastEventAt: new Date() } });
  const users = await tx.user.findMany({ where: userIds ? { id: { in: userIds } } : {}, select: { id: true } });
  const channels = telegram ? await tx.notificationChannel.findMany({ where: { enabled: true, ...(channelId ? { id: channelId } : channelIds ? { id: { in: channelIds } } : {}) } }) : [];
  await tx.notification.createMany({ data: [
    ...users.map((user) => ({ eventId: event.id, recipientKey: `user:${user.id}`, userId: user.id, status: "sent" as const })),
    ...channels.filter((channel) => (channelId || acceptsSeverity(channel.minSeverity, event.severity)) && (channelId || !Array.isArray(channel.sources) || channel.sources.length === 0 || channel.sources.includes(input.source))).map((channel) => ({ eventId: event.id, recipientKey: `channel:${channel.id}`, channelId: channel.id, status: "pending" as const })),
  ], skipDuplicates: true });
  await notifyChanged(tx);
  return event;
}

export async function publishEvent(input: EventInput) {
  return getDatabase().$transaction((tx) => publishEventInTransaction(tx, input));
}

export async function observeEvent(key: string, value: string, input: EventInput | null, options: { cooldownMs?: number; emitInitial?: boolean } = {}) {
  if (!key || key.length > 255 || !value || value.length > 100 || !Number.isFinite(options.cooldownMs ?? 0) || (options.cooldownMs ?? 0) < 0) throw new Error("invalid_event_state");
  return getDatabase().$transaction((tx) => observeEventInTransaction(tx, key, value, input, options));
}

// Call only with an explicit, validated grid signal. Current Venus E3 RPCs do not supply one.
export async function observeMarstekGrid(deviceId: string, available: boolean | null) {
  if (available === null) return;
  return observeEvent(`grid:${deviceId}`, available ? "online" : "offline", { source: "marstek", type: available ? "marstek.grid_restored" : "marstek.grid_lost", severity: available ? "info" : "critical", title: `Marstek ${deviceId}: ${available ? "електромережу відновлено" : "електромережу втрачено"}`, payload: { deviceId } });
}

export async function observeEventInTransaction(tx: EventTransaction, key: string, value: string, input: EventInput | null, options: { cooldownMs?: number; emitInitial?: boolean } = {}) {
  await lockEventKey(tx, key);
  const previous = await tx.eventState.findUnique({ where: { key } });
  const now = input?.occurredAt ?? new Date();
  const publish = input && shouldPublish(previous, value, now, options.cooldownMs, options.emitInitial);
  const event = publish ? await publishEventInTransaction(tx, input) : null;
  if (!previous || previous.value !== value || event) await tx.eventState.upsert({ where: { key }, create: { key, value, lastEventAt: event ? now : null }, update: { value, ...(event ? { lastEventAt: now } : {}) } });
  return event;
}

export async function observeMarstek(tx: EventTransaction, deviceId: string, soc: number | null, sampledAt: Date) {
  const payload = { deviceId };
  await observeEventInTransaction(tx, `device:${deviceId}`, "online", { source: "marstek", type: "marstek.device_online", severity: "info", title: `Marstek ${deviceId}: зв’язок відновлено`, payload, occurredAt: sampledAt });
  if (soc === null) return;
  const key = `battery:${deviceId}`;
  await lockEventKey(tx, key);
  const previous = await tx.eventState.findUnique({ where: { key } });
  const configured = Number(process.env.MARSTEK_LOW_BATTERY_PERCENT ?? 20);
  const low = Number.isFinite(configured) && configured >= 1 && configured <= 90 ? configured : 20;
  const state = batteryState(soc, previous?.value, low, low + 5);
  await observeEventInTransaction(tx, key, state, {
    source: "marstek", type: state === "low" ? "marstek.battery_low" : "marstek.battery_recovered", severity: state === "low" ? "warning" : "info",
    title: `Marstek ${deviceId}: ${state === "low" ? "низький заряд" : "заряд відновлено"} (${soc}%)`, payload: { deviceId, socPercent: soc, threshold: low }, occurredAt: sampledAt,
  });
  // Rearm below 98% to avoid repeated 99/100% events.
  const fullKey = `battery-full:${deviceId}`;
  await lockEventKey(tx, fullKey);
  const full = await tx.eventState.findUnique({ where: { key: fullKey } });
  const fullState = soc >= 100 ? "full" : soc < 98 ? "normal" : full?.value ?? "normal";
  await observeEventInTransaction(tx, fullKey, fullState, fullState === "full" ? { source: "marstek", type: "marstek.fully_charged", severity: "info", title: `Marstek ${deviceId}: батарею повністю заряджено`, payload: { deviceId, socPercent: soc }, occurredAt: sampledAt } : null);
}

export async function observeServiceHealth(service: string, healthy: boolean) {
  return getDatabase().$transaction(async (tx) => {
    const key = `service:${service}`;
    await lockEventKey(tx, key);
    const previous = await tx.eventState.findUnique({ where: { key } });
    const failures = healthy ? 0 : Math.min(3, (previous?.failures ?? 0) + 1);
    const state = healthy ? "up" : failures >= 3 ? "down" : previous?.value ?? "up";
    await observeEventInTransaction(tx, key, state, { source: "system", type: state === "up" ? "system.service_restored" : "system.service_unavailable", severity: state === "up" ? "info" : "error", title: `${service}: ${state === "up" ? "доступ відновлено" : "сервіс недоступний"}`, payload: { service } });
    await tx.eventState.update({ where: { key }, data: { failures } });
  });
}

export interface EventFilters { source?: string; type?: string; severity?: Severity; from?: Date; to?: Date; page?: number }
export async function listEvents(filters: EventFilters = {}) {
  const where: Prisma.EventWhereInput = { source: filters.source, type: filters.type, severity: filters.severity, occurredAt: { gte: filters.from, lte: filters.to } };
  const page = Math.min(10000, Math.max(1, filters.page ?? 1));
  const db = getDatabase();
  const [items, total] = await Promise.all([db.event.findMany({ where, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], skip: (page - 1) * 30, take: 30 }), db.event.count({ where })]);
  return { items, total, page, pageSize: 30 };
}
