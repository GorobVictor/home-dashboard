import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { getFreelancehuntSettings, disconnectDatabase, listFreelancehuntProjects, freelancehuntScan, listEvents } from "@home-dashboard/database";
import { pollFreelancehunt } from "./freelancehunt-poll";

const url = process.env.POLLING_TEST_DATABASE_URL;
test("Freelancehunt real HTTP catch-up persists cursors and isolates ordinary stream failures", { skip: !url }, async () => {
  assert.match(new URL(url!).pathname, /_polling_test$/);
  process.env.DATABASE_URL = url;
  process.env.FREELANCEHUNT_API_TOKEN = "synthetic-polling-test-token";
  let mode = "normal", threadCalls = 0;
  const server = createServer((request,response) => {
    const uri = new URL(request.url!, "http://localhost");
    response.setHeader("Content-Type", "application/json");
    if (uri.pathname === "/v2/skills") { response.end(JSON.stringify({ data: [] })); return; }
    if (uri.pathname === "/v2/projects") {
      if (mode === "failed") { response.writeHead(503); response.end(JSON.stringify({ error: {} })); return; }
      if (mode === "limited") { response.writeHead(429, { "Retry-After": "120" }); response.end(JSON.stringify({ error: {} })); return; }
      const page = Number(uri.searchParams.get("page[number]"));
      response.end(JSON.stringify({ data: [{ id: page, attributes: { name: `Project ${page}`, skills: [] } }], links: page < 12 ? { next: `/v2/projects?page[number]=${page+1}` } : {} })); return;
    }
    if (uri.pathname === "/v2/threads") { threadCalls++; response.end(JSON.stringify({ data: [{ id: 1, attributes: { subject: "Thread", messages_count: 1, is_unread: true } }], links: {} })); return; }
    response.writeHead(501); response.end(JSON.stringify({ error: {} }));
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  process.env.FREELANCEHUNT_API_BASE_URL = `http://127.0.0.1:${address.port}/v2`;
  try {
    const settings = async () => { const row = await getFreelancehuntSettings(); return { ...row, enabled: true, skillIds: row.skillIds as number[] }; };
    await pollFreelancehunt(await settings());
    assert.equal((await listFreelancehuntProjects()).total,5);
    assert.deepEqual(await freelancehuntScan("projects",true), { page: 6, baseline: true });
    await disconnectDatabase();
    await pollFreelancehunt(await settings()); await pollFreelancehunt(await settings());
    assert.equal((await listFreelancehuntProjects()).total,12);
    assert.equal((await listEvents()).total,0);
    mode = "failed"; const before=threadCalls;
    assert.ok(await pollFreelancehunt(await settings()) >= 60000); assert.ok(threadCalls>before);
    mode="limited"; const beforeLimit=threadCalls;
    assert.equal(await pollFreelancehunt(await settings()),120000); assert.equal(threadCalls,beforeLimit);
  } finally {
    delete process.env.FREELANCEHUNT_API_BASE_URL; delete process.env.FREELANCEHUNT_API_TOKEN;
    await new Promise<void>(resolve=>server.close(()=>resolve())); await disconnectDatabase();
  }
});
