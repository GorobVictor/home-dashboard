import assert from "node:assert/strict";
import { test } from "node:test";
import { deliverTelegramMessage, TelegramDeliveryError } from "./telegram";

test("Telegram uses native JSON HTTP, disables previews and validates the message ID", async () => {
  const messageId = await deliverTelegramMessage("private-token", "-123", "hello", async (_url, init) => {
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { chat_id: "-123", text: "hello", link_preview_options: { is_disabled: true } });
    return Response.json({ ok: true, result: { message_id: 123 } });
  });
  assert.equal(messageId, "123");
});

test("Telegram 429 honors retry_after and permanent 403 is not retried", async () => {
  await assert.rejects(deliverTelegramMessage("secret", "-1", "test", async () => Response.json({ ok: false, error_code: 429, description: "untrusted secret", parameters: { retry_after: 120 } }, { status: 429 })), (error: unknown) => error instanceof TelegramDeliveryError && error.retryable && error.retryAfterSeconds === 120 && !error.message.includes("secret"));
  await assert.rejects(deliverTelegramMessage("secret", "-1", "test", async () => Response.json({ ok: false, error_code: 403 }, { status: 403 })), (error: unknown) => error instanceof TelegramDeliveryError && !error.retryable);
});

test("network errors never expose a token or URL and malformed success is rejected", async () => {
  await assert.rejects(deliverTelegramMessage("secret", "-1", "test", async () => { throw new Error("fetch https://api.telegram.org/botsecret failed"); }), { message: "telegram_network_error" });
  await assert.rejects(deliverTelegramMessage("secret", "-1", "test", async () => Response.json({ ok: true })), { message: "telegram_invalid_response" });
  await assert.rejects(deliverTelegramMessage("secret", "-1", "test", async () => Response.json({ ok: false, error_code: 500 })), (error: unknown) => error instanceof TelegramDeliveryError && error.retryable);
});
