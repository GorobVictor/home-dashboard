import assert from "node:assert/strict";
import { test } from "node:test";
import { channelMatches, nextDeliveryAt } from "./channel-policy";
test("daily digests supplement immediate alerts without changing type/device/severity filters", () => {
  const channel = { minSeverity: "info" as const, sources: ["marstek"], eventTypes: ["marstek.battery_low"], deviceIds: ["battery-1"] };
  const event = { source: "marstek", type: "marstek.battery_low", severity: "warning" as const, payload: { deviceId: "battery-1" } };
  assert.equal(channelMatches(channel, event), true);
  assert.equal(channelMatches(channel, { ...event, payload: { deviceId: "other" } }), false);
  assert.equal(channelMatches({ ...channel, digest: true }, event), true);
  assert.equal(channelMatches({ ...channel, digest: true }, { ...event, payload: { deviceId: "other" } }), false);
  assert.equal(channelMatches({ ...channel, digest: true, minSeverity: "error" }, event), false);
  assert.equal(channelMatches({ ...channel, digest: true }, { ...event, severity: "critical" }), true);
});
test("Freelancehunt projects are delivered individually with either digest setting", () => {
  const event = { source: "freelancehunt", type: "freelancehunt.project_created", severity: "info" as const };
  for (const digest of [false, true]) assert.equal(channelMatches({ minSeverity: "info", sources: ["freelancehunt"], digest }, event), true);
});
test("Kyiv quiet hours postpone without spending an attempt and critical alerts bypass them", () => {
  const channel = { quietFrom: "22:00", quietTo: "08:00" }, now = new Date("2026-10-23T21:00:00Z");
  assert.equal(nextDeliveryAt(channel, now, "warning").toISOString(), "2026-10-24T05:00:00.000Z");
  assert.equal(nextDeliveryAt(channel, now, "critical"), now);
  assert.equal(nextDeliveryAt({ quietFrom: "", quietTo: "" }, now, "info"), now);
});
