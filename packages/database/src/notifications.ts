import { randomUUID } from "node:crypto";
import { getDatabase } from "./client";
import { notifyChanged, lockEventKey, publishEventInTransaction } from "./events";
import { acceptsSeverity, retryDelayMs, type Severity } from "./event-policy";

export interface ChannelInput { name: string; chatId: string; enabled: boolean; minSeverity: Severity; sources: string[] }
export const listNotificationChannels = () => getDatabase().notificationChannel.findMany({ orderBy: { createdAt: "asc" } });

export async function saveNotificationChannel(input: ChannelInput, id?: string) {
  return getDatabase().$transaction(async (tx) => {
    const channel = id ? await tx.notificationChannel.update({ where: { id }, data: input }) : await tx.notificationChannel.create({ data: input });
    // Pending work must never silently move to a different destination.
    if (id) await tx.notification.updateMany({ where: { channelId: id, status: "pending" }, data: { status: "cancelled" } });
    await notifyChanged(tx);
    return channel;
  });
}

export async function removeNotificationChannel(id: string) {
  // Archive so delivery history retains its destination and configuration reference.
  const channel = await getDatabase().notificationChannel.findUniqueOrThrow({ where: { id } });
  return saveNotificationChannel({ name: channel.name, chatId: channel.chatId, minSeverity: channel.minSeverity, enabled: false, sources: Array.isArray(channel.sources) ? channel.sources.filter((s): s is string => typeof s === "string") : [] }, id);
}

export async function initializeLegacyTelegramChannel(chatId: string) {
  const db = getDatabase();
  // Only import the environment destination once; subsequent UI edits are authoritative.
  await db.$transaction(async (tx) => {
    await lockEventKey(tx, "legacy-telegram-import");
    if (await tx.eventState.findUnique({ where: { key: "legacy-telegram-import" } })) return;
    const settings = await tx.freelancehuntSettings.findUnique({ where: { id: "default" } });
    await tx.notificationChannel.upsert({ where: { kind_chatId: { kind: "telegram", chatId } }, create: { name: "Freelancehunt Telegram", chatId, enabled: settings?.telegramEnabled ?? true, sources: ["freelancehunt"] }, update: {} });
    await tx.eventState.create({ data: { key: "legacy-telegram-import", value: "done" } });
  });
}

export async function listNotifications(userId: string, page = 1, unread = false) {
  const db = getDatabase();
  const where = { userId, ...(unread ? { readAt: null } : {}) };
  const [items, total, unreadCount] = await Promise.all([
    db.notification.findMany({ where, include: { event: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
    db.notification.count({ where }), db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, total, unreadCount, page, pageSize: 20 };
}

export async function markNotificationsRead(userId: string, id?: string) {
  return getDatabase().$transaction(async (tx) => {
    const result = await tx.notification.updateMany({ where: { userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
    await notifyChanged(tx);
    return result.count;
  });
}

export async function listNotificationDeliveries(channelId?: string, page = 1) {
  const db = getDatabase();
  const pageSize = 5;
  const where = channelId ? { notification: { channelId } } : {};
  const [items, total] = await Promise.all([
    db.notificationDelivery.findMany({ where, include: { notification: { select: { status: true, nextAttemptAt: true, event: { select: { title: true, type: true } } } } }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: pageSize, skip: (page - 1) * pageSize }),
    db.notificationDelivery.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function testNotificationChannel(channelId: string, userId: string) {
  return getDatabase().$transaction(async (tx) => {
    await lockEventKey(tx, `test:${userId}`);
    const channel = await tx.notificationChannel.findUnique({ where: { id: channelId } });
    if (!channel?.enabled) throw new Error("channel_disabled");
    const recent = await tx.event.findFirst({ where: { type: "system.test_notification", payload: { path: ["userId"], equals: userId }, occurredAt: { gt: new Date(Date.now() - 30_000) } } });
    if (recent) throw new Error("test_rate_limited");
    return publishEventInTransaction(tx, { source: "system", type: "system.test_notification", severity: "info", title: "Home Dashboard: тестове сповіщення", payload: { userId }, channelId, deduplicationKey: `test:${randomUUID()}` });
  });
}

export async function claimNotification(now = new Date()) {
  const db = getDatabase();
  return db.$transaction(async (tx) => {
    const row = await tx.notification.findFirst({
      where: { channelId: { not: null }, OR: [{ status: "pending", nextAttemptAt: { lte: now } }, { status: "processing", leaseUntil: { lte: now } }] },
      orderBy: { nextAttemptAt: "asc" }, include: { event: true, channel: true },
    });
    if (!row) return null;
    const channel = row.channel;
    const sources = channel?.sources;
    const test = row.event.type === "system.test_notification";
    const eligible = channel?.enabled && (test || (acceptsSeverity(channel.minSeverity, row.event.severity) && (!Array.isArray(sources) || sources.length === 0 || sources.includes(row.event.source))));
    const skip = !eligible || row.attemptCount >= 6;
    const claimed = await tx.notification.updateMany({ where: { id: row.id, status: row.status, attemptCount: row.attemptCount }, data: skip ? { status: row.attemptCount >= 6 ? "failed" : "cancelled", leaseUntil: null } : { status: "processing", leaseUntil: new Date(now.getTime() + 120_000), attemptCount: { increment: 1 } } });
    if (!claimed.count) return null;
    if (row.status === "processing") await tx.notificationDelivery.updateMany({ where: { notificationId: row.id, status: "processing" }, data: { status: "unknown", finishedAt: now, errorCode: "worker_lease_expired" } });
    if (skip || !channel) return { skipped: true as const };
    const delivery = await tx.notificationDelivery.create({ data: { notificationId: row.id, attempt: row.attemptCount + 1, destination: channel.chatId, status: "processing", startedAt: now } });
    return { skipped: false as const, notification: row, delivery, chatId: channel.chatId };
  });
}

export async function finishNotification(deliveryId: string, result: { messageId?: string; errorCode?: string; retryable?: boolean; retryAfterSeconds?: number }, now = new Date()) {
  return getDatabase().$transaction(async (tx) => {
    const delivery = await tx.notificationDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
    if (delivery.status !== "processing") return;
    const success = !result.errorCode;
    const status = success ? "sent" : result.retryable !== false && delivery.attempt < 6 ? "pending" : "failed";
    await tx.notificationDelivery.update({ where: { id: deliveryId }, data: { status: success ? "sent" : "failed", finishedAt: now, errorCode: result.errorCode, externalMessageId: result.messageId } });
    await tx.notification.update({ where: { id: delivery.notificationId }, data: { status, leaseUntil: null, nextAttemptAt: new Date(now.getTime() + (status === "pending" ? retryDelayMs(delivery.attempt, result.retryAfterSeconds) : 0)) } });
    await notifyChanged(tx);
  });
}
