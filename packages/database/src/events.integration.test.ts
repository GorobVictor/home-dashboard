import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabase, disconnectDatabase } from "./client";
import { publishEvent, observeEvent, observeServiceHealth } from "./events";
import { claimNotification, finishNotification, markNotificationsRead, listNotifications, saveNotificationChannel } from "./notifications";

// Opt-in only: run against a disposable database, never the application's database.
const testUrl = process.env.EVENTS_TEST_DATABASE_URL;
test("PostgreSQL event deduplication, user isolation and restart-safe deliveries", { skip: !testUrl }, async (t) => {
  assert.match(new URL(testUrl!).pathname, /_events_test$/);
  process.env.DATABASE_URL = testUrl;
  const db = getDatabase();
  const user = await db.user.create({ data: { firstName: "Test", lastName: "User", login: "events-test", passwordHash: "not-a-real-password" } });
  const other = await db.user.create({ data: { firstName: "Other", lastName: "User", login: "events-other", passwordHash: "not-a-real-password" } });
  const channel = await saveNotificationChannel({ name: "Mock Telegram", chatId: "-123456", enabled: true, minSeverity: "warning", sources: ["system"] });
  const input = { source: "system", type: "system.test", severity: "critical" as const, title: "Repository test", deduplicationKey: "unique-event" };
  try {
    await t.test("concurrent publishers create one immutable event and one notification per recipient", async () => {
      const events = await Promise.all(Array.from({ length: 4 }, () => publishEvent(input)));
      assert.equal(new Set(events.map((event) => event.id)).size, 1);
      assert.equal(await db.event.count(), 1);
      assert.equal(await db.notification.count(), 3);
      await assert.rejects(db.event.update({ where: { id: events[0].id }, data: { title: "Changed" } }));
      await assert.rejects(publishEvent({ ...input, deduplicationKey: "unsafe", payload: { nested: { token: "must-not-persist" } } }), /unsafe_event_payload/);
    });
    await t.test("read status is scoped to the authenticated user", async () => {
      const inbox = await listNotifications(user.id);
      await markNotificationsRead(other.id, inbox.items[0].id);
      assert.equal((await listNotifications(user.id)).unreadCount, 1);
      await markNotificationsRead(user.id, inbox.items[0].id);
      assert.equal((await listNotifications(user.id)).unreadCount, 0);
      assert.equal((await listNotifications(other.id)).unreadCount, 1);
    });
    await t.test("retry scheduling and sent status prevent a second completed delivery", async () => {
      const now = new Date("2030-01-01T00:00:00Z");
      const first = await claimNotification(now);
      assert.ok(first && !first.skipped);
      assert.equal(await claimNotification(now), null);
      await finishNotification(first.delivery.id, { errorCode: "telegram_http_429", retryable: true, retryAfterSeconds: 20 }, now);
      assert.equal(await claimNotification(new Date(now.getTime() + 19_999)), null);
      const retry = await claimNotification(new Date(now.getTime() + 20_000));
      assert.ok(retry && !retry.skipped);
      assert.equal(retry.delivery.attempt, 2);
      await finishNotification(retry.delivery.id, { messageId: "42" }, now);
      await finishNotification(retry.delivery.id, { errorCode: "duplicate_finish" }, now);
      assert.equal(await claimNotification(new Date(now.getTime() + 864e5)), null);
      assert.equal((await db.notification.findUniqueOrThrow({ where: { id: first.notification.id } })).status, "sent");
    });
    await t.test("expired leases recover after restart and stale completions cannot overwrite results", async () => {
      await publishEvent({ ...input, deduplicationKey: "recover" });
      const now = new Date("2030-01-02T00:00:00Z");
      const first = await claimNotification(now);
      assert.ok(first && !first.skipped);
      await disconnectDatabase();
      const recovered = await claimNotification(new Date(now.getTime() + 120_001));
      assert.ok(recovered && !recovered.skipped);
      assert.equal(recovered.delivery.attempt, 2);
      await finishNotification(first.delivery.id, { messageId: "stale" }, now);
      assert.equal((await getDatabase().notificationDelivery.findUniqueOrThrow({ where: { id: first.delivery.id } })).status, "unknown");
      await finishNotification(recovered.delivery.id, { messageId: "recovered" }, now);
    });
    await t.test("six failed attempts exhaust retry budget", async () => {
      await publishEvent({ ...input, deduplicationKey: "exhaust" });
      for (let attempt = 1; attempt <= 6; attempt++) {
        const now = new Date(Date.UTC(2030, 0, 3, attempt));
        const work = await claimNotification(now);
        assert.ok(work && !work.skipped);
        assert.equal(work.delivery.attempt, attempt);
        await finishNotification(work.delivery.id, { errorCode: "telegram_http_500", retryable: true }, now);
      }
      assert.equal(await claimNotification(new Date("2031-01-01")), null);
    });
    await t.test("durable transitions survive a client restart and time windows suppress duplicates", async () => {
      const transition = { source: "marstek", type: "marstek.battery_low", severity: "warning" as const, title: "Low", telegram: false };
      await observeEvent("state-test", "normal", transition);
      await observeEvent("state-test", "low", transition);
      await disconnectDatabase();
      await observeEvent("state-test", "low", transition);
      assert.equal(await getDatabase().event.count({ where: { type: transition.type } }), 1);
      const windowed = { ...input, telegram: false, deduplicationKey: "window", deduplicationWindowMs: 60_000 };
      assert.equal((await publishEvent(windowed)).id, (await publishEvent(windowed)).id);
      await getDatabase().eventState.updateMany({ where: { key: { startsWith: "dedup:" } }, data: { lastEventAt: new Date(0) } });
      const next = await publishEvent(windowed);
      assert.equal(await getDatabase().event.count({ where: { type: input.type, deduplicationKey: { startsWith: "window:" } } }), 2);
      assert.ok(next.id);
    });
    await t.test("service failures require three observations and recovery occurs only once", async () => {
      await observeServiceHealth("mock-service", false);
      await observeServiceHealth("mock-service", false);
      assert.equal(await getDatabase().event.count({ where: { type: "system.service_unavailable" } }), 0);
      await observeServiceHealth("mock-service", false);
      await observeServiceHealth("mock-service", false);
      await observeServiceHealth("mock-service", true);
      await observeServiceHealth("mock-service", true);
      assert.equal(await getDatabase().event.count({ where: { type: "system.service_unavailable" } }), 1);
      assert.equal(await getDatabase().event.count({ where: { type: "system.service_restored" } }), 1);
    });
  } finally { await disconnectDatabase(); }
});
