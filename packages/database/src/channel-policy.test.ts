import assert from "node:assert/strict";
import { test } from "node:test";
import { channelMatches, nextDeliveryAt } from "./channel-policy";
test("channel type/device filters scope events and digest channels keep critical alerts immediate", () => {
  const channel = { minSeverity: "info" as const, sources: ["marstek"], eventTypes: ["marstek.battery_low"], deviceIds: ["battery-1"] };
  const event = { source: "marstek", type: "marstek.battery_low", severity: "warning" as const, payload: { deviceId: "battery-1" } };
  assert.equal(channelMatches(channel, event), true);
  assert.equal(channelMatches(channel, { ...event, payload: { deviceId: "other" } }), false);
  assert.equal(channelMatches({ ...channel, digest: true }, event), false);
  assert.equal(channelMatches({ ...channel, digest: true }, { ...event, severity: "critical" }), true);
});
test("Kyiv quiet hours postpone without spending an attempt and critical alerts bypass them", () => {
  const channel = { quietFrom: "22:00", quietTo: "08:00" }, now = new Date("2026-10-23T21:00:00Z");
  assert.equal(nextDeliveryAt(channel, now, "warning").toISOString(), "2026-10-24T05:00:00.000Z");
  assert.equal(nextDeliveryAt(channel, now, "critical"), now);
  assert.equal(nextDeliveryAt({ quietFrom: "", quietTo: "" }, now, "info"), now);
});
