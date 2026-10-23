import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoginLimiter } from "./rate-limit";
import { readJson } from "../body";
import { NextRequest } from "next/server";
test("login attempts share account and IP budgets, success recovers and idle entries expire", () => {
  const limit = createLoginLimiter();
  for (let i = 0; i < 5; i++) { const attempt = limit(" User ", `ip-${i}`, 0); assert.equal(attempt.retryAfter, 0); attempt.finish(false); }
  assert.ok(limit("user", "new-ip", 1).retryAfter > 0);
  const success = limit("user", "new-ip", 2000); assert.equal(success.retryAfter, 0); success.finish(true);
  assert.equal(limit("user", "new-ip", 2001).retryAfter, 0);
  assert.equal(limit("other", "different", 16 * 60000).retryAfter, 0);
});
test("chunked JSON is bounded even when Content-Length is absent", async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"x":"' + "a".repeat(5000))); controller.close(); } });
  const request = new NextRequest(new Request("http://localhost/", { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit));
  await assert.rejects(readJson(request), /invalid_input/);
});
