import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProjectFilters, parseProjectStatePatch, projectStateChanges, uniqueNewProjects } from "./freelancehunt-rules";

test("filters validate ranges, numeric IDs, actual dates and bounded arrays", () => {
  assert.deepEqual(parseProjectFilters({ skillIds: [24, 24], minBudget: 0, maxBudget: 5000 }).skillIds, [24]);
  for (const value of [{ minBudget: 20, maxBudget: 10 }, { from: "2026-02-30" }, { from: "2026-10-12", to: "2026-10-11" }, { currency: "usd" }, { skillIds: ["24"] }, { state: "unknown" }, { include: Array(31).fill("word") }, { minBudget: Infinity }, { sort: "popularity" }, { unknown: true }]) assert.throws(() => parseProjectFilters(value));
});
test("save, unsave and hide patches preserve unrelated notes and viewed state", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  assert.deepEqual(projectStateChanges(parseProjectStatePatch({ saved: true }), now), { savedAt: now });
  assert.deepEqual(projectStateChanges({ saved: false, hidden: true, viewed: true, notes: "Personal" }, now), { savedAt: null, hiddenAt: now, viewedAt: now, notes: "Personal" });
  assert.deepEqual(projectStateChanges({ hidden: false }), { hiddenAt: null });
  for (const patch of [{ viewed: false }, { userId: "someone" }, { saved: "true" }, { notes: "x".repeat(3001) }, {}]) assert.throws(() => parseProjectStatePatch(patch));
});
test("deduplication suppresses known and repeated IDs in the same synchronization", () => {
  const known = new Set([1]);
  assert.deepEqual(uniqueNewProjects([{ id: 1 }, { id: 2 }, { id: 2 }, { id: 3 }], known), [{ id: 2 }, { id: 3 }]);
  assert.deepEqual([...known], [1]);
});
