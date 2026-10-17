import assert from "node:assert/strict";
import { test } from "node:test";
import { FreelancehuntClient } from "./freelancehunt";

test("Freelancehunt client sends configured skill IDs and normalizes project data", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [{
      id: 123, attributes: {
        name: "Build dashboard", description: "A small dashboard", budget: { amount: 5000, currency: "UAH" },
        skills: [{ id: 103, name: "TypeScript" }], published_at: "2026-10-15T10:00:00+00:00",
      }, links: { self: { web: "https://freelancehunt.com/project/123.html" } },
    }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const projects = await new FreelancehuntClient("secret").listProjects([103, 120]);
    assert.match(requestedUrl, /filter%5Bskill_id%5D=103%2C120/);
    assert.deepEqual(projects[0], {
      id: 123, name: "Build dashboard", description: "A small dashboard", url: "https://freelancehunt.com/project/123.html",
      budgetAmount: 5000, budgetCurrency: "UAH", skills: ["TypeScript"], skillIds: [103], categories: [], publishedAt: new Date("2026-10-15T10:00:00+00:00"),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("project details use a separate no-store request and narrow optional fields", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input, options) => {
    calls++;
    assert.equal(String(input), "https://api.freelancehunt.com/v2/projects/123");
    assert.equal(options?.cache, "no-store");
    assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer secret");
    return Response.json({ data: { id: 123, attributes: { name: "Fresh title", description: "Current description", budget: { amount: 8000, currency: "UAH" }, skills: [{ id: 24, name: "C#" }], status: { name: "Open" }, bid_count: 7, expired_at: "2026-11-01T00:00:00Z" }, links: { self: { web: "javascript:alert(1)" } } } });
  };
  try {
    const details = await new FreelancehuntClient("secret").getProject(123);
    assert.equal(details.name, "Fresh title"); assert.equal(details.budgetAmount, 8000);
    assert.equal(details.status, "Open"); assert.equal(details.bidCount, 7);
    assert.equal(details.url, "https://freelancehunt.com/project/123.html");
    await assert.rejects(new FreelancehuntClient("secret").getProject(-1), /invalid_project_id/);
    assert.equal(calls, 1);
    globalThis.fetch = async () => Response.json({ data: { id: 456, attributes: { name: "Wrong ID" } } });
    await assert.rejects(new FreelancehuntClient("secret").getProject(123), /invalid_project_response/);
  } finally { globalThis.fetch = originalFetch; }
});

test("Freelancehunt client rejects rate-limited responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: {} }), { status: 429 });
  try {
    await assert.rejects(new FreelancehuntClient("secret").listThreads(), /freelancehunt_rate_limited/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Freelancehunt client lists complete named skill filters", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ id: 120, type: "skill", attributes: { name: "Node.js", group: { id: 1, name: "Programming" } } }, { id: 103, type: "skill", attributes: { name: "TypeScript", group: { id: 1, name: "Programming" } } }] }), { status: 200 });
  try {
    assert.deepEqual(await new FreelancehuntClient("secret").listSkills(), [{ id: 120, name: "Node.js", groupName: "Programming" }, { id: 103, name: "TypeScript", groupName: "Programming" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
