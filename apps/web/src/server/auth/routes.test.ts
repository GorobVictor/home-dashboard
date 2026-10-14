import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as login } from "../../app/api/auth/login/route";
import { POST as logout } from "../../app/api/auth/logout/route";
import { sameOrigin } from "./http";

test("same-origin requests behind a reverse proxy use the public host and protocol", () => {
  const request = new NextRequest("http://0.0.0.0:3000/api/auth/login", {
    method: "POST",
    headers: { origin: "https://dashboard.example", host: "127.0.0.1:3000", "x-forwarded-host": "dashboard.example", "x-forwarded-proto": "https" },
  });
  assert.equal(sameOrigin(request), true);
});

test("login rejects cross-origin requests before reading credentials", async () => {
  const response = await login(new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { origin: "https://another.example", "content-type": "application/json" },
    body: JSON.stringify({ login: "ada", password: "test-password" }),
  }));
  assert.equal(response.status, 403);
});

test("login rejects malformed JSON without querying the database", async () => {
  const response = await login(new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad json",
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_input" });
});

test("logout clears the HttpOnly session cookie", async () => {
  const response = await logout(new NextRequest("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /home_dashboard_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Max-Age=0/);
});
