import assert from "node:assert/strict";
import { test } from "node:test";
import { parseChannel, parseEventFilters, pageNumber } from "./notifications";

test("channel parsing validates destination, severity, sources and rejects secret fields", () => {
  const input = { name: "Home", chatId: "-100123", enabled: true, minSeverity: "warning", sources: ["marstek"] };
  assert.deepEqual(parseChannel(input), input);
  for (const change of [{ chatId: "https://evil" }, { minSeverity: "debug" }, { enabled: "true" }, { token: "secret" }, { sources: ["unknown"] }]) assert.throws(() => parseChannel({ ...input, ...change }));
});

test("event filters reject invalid dates, inverted ranges and unbounded pagination", () => {
  assert.throws(() => parseEventFilters(new URLSearchParams({ from: "2026-02-30" })));
  assert.throws(() => parseEventFilters(new URLSearchParams({ from: "2026-10-10", to: "2026-10-01" })));
  assert.throws(() => pageNumber(new URLSearchParams({ page: "10001" })));
  assert.equal(parseEventFilters(new URLSearchParams({ severity: "critical", from: "2026-10-16" })).from?.toISOString(), "2026-10-16T00:00:00.000Z");
});

test("channel relevance profiles and thresholds are bounded and validated", () => {
  const input = { name: "Home", chatId: "-100123", enabled: true, minSeverity: "info", sources: ["freelancehunt"], projectMinScore: 80, projectScoring: { base: 10, rules: [{ field: "technology", term: "C#", weight: 90 }] } };
  assert.deepEqual(parseChannel(input), input);
  assert.throws(() => parseChannel({ ...input, projectMinScore: 101 }));
  assert.throws(() => parseChannel({ ...input, projectScoring: { base: 10, rules: [{ field: "unknown", term: "C#", weight: 90 }] } }));
});
