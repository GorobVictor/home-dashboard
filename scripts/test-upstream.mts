import assert from "node:assert/strict";
import { FreelancehuntClient, FreelancehuntError } from "../packages/integrations/src/freelancehunt";
const client = new FreelancehuntClient("synthetic-test-token", 1000, "http://127.0.0.1:4900/freelancehunt/v2");
const first = await client.projectPage([24], 1), second = await client.projectPage([24], 2);
assert.equal(first.more, true); assert.equal(second.more, false); assert.equal(second.items[0].id, 2);
await assert.rejects(client.threadPage(1), error => error instanceof FreelancehuntError && error.retryAfterSeconds === 120);
console.info("Real HTTP client verified against local pagination and 429 simulation.");
