import { getDatabase } from "./client";

export async function recordHealth(service: string, healthy: boolean, code = "", now = new Date()) {
  const key = `health:${service}`;
  const value = healthy ? "ok" : code.slice(0, 100) || "failed";
  return getDatabase().eventState.upsert({ where: { key }, create: { key, value, lastObservedAt: now, lastEventAt: healthy ? now : null }, update: { value, lastObservedAt: now, ...(healthy ? { lastEventAt: now } : {}) } });
}

export async function getSystemStatus() {
  const db = getDatabase();
  const [jobs, devices, pending, failed, size, rollups] = await Promise.all([
    db.eventState.findMany({ where: { key: { startsWith: "health:" } }, select: { key: true, value: true, lastObservedAt: true, lastEventAt: true } }),
    db.marstekDevice.findMany({ select: { id: true, name: true, enabled: true, lastSeenAt: true, lastError: true } }),
    db.notification.count({ where: { channelId: { not: null }, status: { in: ["pending", "processing"] } } }),
    db.notification.count({ where: { channelId: { not: null }, status: "failed" } }),
    db.$queryRaw<{ bytes: string }[]>`SELECT pg_database_size(current_database())::text AS bytes`,
    db.eventState.findUnique({ where: { key: "marstek:aggregate-backfill" }, select: { value: true } }),
  ]);
  return { checkedAt: new Date().toISOString(), jobs, devices, pending, failed, databaseBytes: Number(size[0]?.bytes ?? 0), aggregateBackfillUntil: rollups?.value ?? null };
}
