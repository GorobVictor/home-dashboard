import assert from "node:assert/strict";
import { test } from "node:test";
import { initialScoringProfiles, scoreProject, parseProjectFilters, parseScoringProfile, parseProjectStatePatch, projectStateChanges, uniqueNewProjects, type ScorableProject, type ScoringProfile } from "./freelancehunt-rules";

const project: ScorableProject = { name: "C# backend API", description: "ASP.NET Core with PostgreSQL and Docker", skills: ["C#"], categories: ["Programming"], budgetAmount: 5000, budgetCurrency: "UAH" };
test("scoring is deterministic, editable and explains all contributions once", () => {
  const profile: ScoringProfile = { base: 10, rules: [{ field: "technology", term: "C#", weight: 20 }, { field: "title", term: "backend", weight: 10 }, { field: "description", term: "postgresql", weight: 15 }, { field: "category", term: "programming", weight: 10 }, { field: "budget", term: "", currency: "UAH", minimum: 5000, maximum: 6000, weight: 20 }, { field: "keyword", term: "API", weight: -5 }] };
  const result = scoreProject(project, parseScoringProfile(profile));
  assert.equal(result.score, 80); assert.equal(result.reasons.length, 7);
  assert.deepEqual(scoreProject(project, profile), result);
  assert.equal(scoreProject(project, { base: 0, rules: [] }).score, 0);
  assert.equal(scoreProject(project, { base: 100, rules: [{ field: "technology", term: "C#", weight: 100 }] }).score, 100);
  assert.equal(scoreProject(project, { base: 0, rules: [{ field: "technology", term: "C#", weight: -100 }] }).score, 0);
  assert.equal(scoreProject({ ...project, budgetCurrency: "USD" }, profile).score, 60);
  assert.equal(scoreProject({ ...project, budgetAmount: null }, profile).score, 60);
});
test("technology boundaries handle punctuation and do not match AWS inside draws", () => {
  const profile: ScoringProfile = { base: 0, rules: ["C#", ".NET", "AWS"].map((term) => ({ field: "technology", term, weight: 10 })) };
  assert.equal(scoreProject({ ...project, name: "C# .NET draws", description: null }, profile).score, 20);
  assert.equal(scoreProject({ ...project, name: "AWS AWS", skills: [], description: null }, profile).score, 10);
  for (const preset of initialScoringProfiles) assert.deepEqual(parseScoringProfile(preset.profile), preset.profile);
});
test("filters validate ranges, numeric IDs, actual dates and bounded arrays", () => {
  assert.deepEqual(parseProjectFilters({ skillIds: [24, 24], minBudget: 0, maxBudget: 5000 }).skillIds, [24]);
  for (const value of [{ minBudget: 20, maxBudget: 10 }, { minScore: 90, maxScore: 80 }, { from: "2026-02-30" }, { from: "2026-10-12", to: "2026-10-11" }, { currency: "usd" }, { skillIds: ["24"] }, { state: "unknown" }, { include: Array(31).fill("word") }, { minBudget: Infinity }]) assert.throws(() => parseProjectFilters(value));
  for (const value of [{ base: 0, rules: [{ field: "technology", term: "", weight: 10 }] }, { base: 20, rules: [{ field: "budget", term: "", weight: 10, currency: "UAH", minimum: 10, maximum: 5 }] }, { base: 0, rules: [{ field: "keyword", term: "word", weight: 101 }] }]) assert.throws(() => parseScoringProfile(value));
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
