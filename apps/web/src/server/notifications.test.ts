import assert from "node:assert/strict";
import { test } from "node:test";
import { parseChannel, parseEventFilters, pageNumber } from "./notifications";
import { parseSite } from "./sites";

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
test("site URLs reject executable protocols, credentials and invalid bounds", () => {
  const site = { name: "Site", url: "https://example.com/", description: "", group: "Home", position: 0 };
  assert.equal(parseSite(site).url,site.url);
  for (const update of [{ url: "javascript:alert(1)" }, { url: "http://example.com" }, { url: "https://name:password@example.com" }, { position: -1 }, { token: "no" }]) assert.throws(()=>parseSite({ ...site, ...update }));
});
test("channel quiet-hour and type/device rules remain bounded", () => {
  const channel = { name: "Home", chatId: "-100123", enabled: true, minSeverity: "warning", sources: [], eventTypes: ["marstek.battery_low"], deviceIds: ["battery-1"], quietFrom: "22:00", quietTo: "08:00", digest: true };
  assert.equal(parseChannel(channel).digest,true);
  for (const update of [{ quietFrom:"25:00" }, { quietTo:"" }, { deviceIds:["bad id"] }, { eventTypes:["Bad"] }]) assert.throws(()=>parseChannel({ ...channel, ...update }));
});
