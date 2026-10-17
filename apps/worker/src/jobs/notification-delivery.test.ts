import assert from "node:assert/strict";
import { test } from "node:test";
import { TelegramDeliveryError } from "@home-dashboard/integrations";
import { processNotifications, type DeliveryOperations } from "./notification-delivery";

function fixture() {
  const now = new Date("2026-10-17T10:05:06Z");
  const work = {
    skipped: false,
    notification: {
      id: "notification", eventId: "event", channelId: "channel", channel: null, userId: null,
      recipientKey: "channel:channel", readAt: null, status: "processing", attemptCount: 1,
      nextAttemptAt: now, leaseUntil: now, createdAt: now,
      event: { id: "event", deduplicationKey: null, source: "marstek", type: "marstek.battery_low", title: "Low battery", severity: "warning", occurredAt: now, payload: { deviceId: "venus-e3-1", socPercent: 15 } },
    },
    delivery: { id: "attempt", notificationId: "notification", attempt: 1, status: "processing", destination: "-123", startedAt: now, finishedAt: null, errorCode: null, externalMessageId: null },
    chatId: "-123",
  } satisfies Awaited<ReturnType<DeliveryOperations["claim"]>>;
  let pending = true;
  let sent = 0;
  const results: Parameters<DeliveryOperations["finish"]>[1][] = [];
  const operations: DeliveryOperations = {
    async claim() { if (!pending) return null; pending = false; return work; },
    async send() { sent++; return "message-1"; },
    async finish(_id, result) { results.push(result); },
  };
  return { operations, results, sent: () => sent };
}

test("completed deliveries are not sent again on the next processing cycle", async () => {
  const f = fixture();
  await processNotifications(f.operations, "secret");
  await processNotifications(f.operations, "secret");
  assert.equal(f.sent(), 1);
  assert.deepEqual(f.results, [{ messageId: "message-1" }]);
});

test("delivery passes formatted event details to the configured chat", async () => {
  const f = fixture();
  f.operations.send = async (token, chatId, message) => {
    assert.equal(token, "secret");
    assert.equal(chatId, "-123");
    assert.notEqual(typeof message, "string");
    if (typeof message !== "string") {
      assert.equal(message.parseMode, "HTML");
      assert.match(message.text, /<b>🪫 Низький заряд батареї<\/b>/);
      assert.match(message.text, /Заряд: <b>15%<\/b>/);
    }
    return "formatted-message";
  };
  await processNotifications(f.operations, "secret");
  assert.deepEqual(f.results, [{ messageId: "formatted-message" }]);
});

test("delivery failures are persisted with retry metadata and no raw error details", async () => {
  const f = fixture();
  f.operations.send = async () => { throw new TelegramDeliveryError("telegram_http_429", true, 45); };
  await processNotifications(f.operations, "secret");
  assert.deepEqual(f.results, [{ errorCode: "telegram_http_429", retryable: true, retryAfterSeconds: 45 }]);
});

test("database failure after HTTP success is not recorded as a failed HTTP request", async () => {
  const f = fixture();
  let calls = 0;
  f.operations.finish = async () => { calls++; throw new Error("database_failed"); };
  await assert.rejects(processNotifications(f.operations, "secret"), /database_failed/);
  assert.equal(calls, 1);
  assert.equal(f.sent(), 1);
});

test("missing bot token leaves pending work untouched", async () => {
  const f = fixture();
  f.operations.claim = async () => { throw new Error("must_not_claim"); };
  await processNotifications(f.operations, "");
  assert.equal(f.sent(), 0);
});
