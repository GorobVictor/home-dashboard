import assert from "node:assert/strict";
import { test } from "node:test";
import { chartDate, customDateRange, formatDate } from "../../lib/dates";
import { buildMarstekHistory } from "./history";
import { csv } from "../csv";

test("chart tooltip uses payload timestamp instead of the shadcn series label", () => {
  const timestamp = Date.parse("2026-10-23T12:00:00Z");
  assert.equal(chartDate("Charge", [{ payload: { timestamp } }]), formatDate(timestamp));
  assert.equal(chartDate(undefined, [{ payload: { time: "2026-10-23T12:00:00Z" } }]), formatDate(timestamp));
  assert.equal(chartDate("Charge", []), "—");
  assert.equal(chartDate("Charge", [{ payload: { timestamp: NaN } }]), "—");
});
test("today's custom range clamps to now while invalid and future dates fail", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  assert.equal(customDateRange("2026-10-23", "2026-10-23", now)?.to.toISOString(), now.toISOString());
  for (const [from, to] of [["2026-02-30","2026-03-01"],["2026-10-24","2026-10-24"],["2026-10-22",""]]) assert.throws(() => customDateRange(from, to, now));
});
test("temperature remains null through outages and unavailable power does not become measured zero", () => {
  const start = new Date("2026-10-23T00:00:00Z"), end = new Date("2026-10-23T01:00:00Z");
  const base = { socPercent: 50, chargePowerW: null, dischargePowerW: null, gridPowerW: null, pvPowerW: null, chargeEnergyWh: null, dischargeEnergyWh: null };
  const history = buildMarstekHistory([{ ...base, sampledAt: start, batteryTemperatureC: 25 }, { ...base, sampledAt: new Date(start.getTime() + 1200000), batteryTemperatureC: null }], start, end, 60);
  assert.deepEqual(history.points.map(point => point.temperature), [25, null, null]);
  assert.ok(history.points.every(point => point.charge === null));
  assert.equal(history.energy[0].chargeWh, null);
});
test("CSV quotes newlines and prevents formula execution, including leading whitespace", () => {
  const output = csv([["=1+1", "  @SUM(A1)", "a,\"b\"\nc", -12, null]]);
  assert.ok(output.includes("'=1+1")); assert.ok(output.includes("'  @SUM(A1)"));
  assert.ok(output.includes('"a,""b""\nc"')); assert.ok(output.includes('"-12"'));
});
test("downsampling retains a short temperature-only data gap", () => {
  const start = new Date("2026-10-23T00:00:00Z");
  const rows = Array.from({ length: 1200 }, (_,index) => ({ sampledAt: new Date(start.getTime() + index * 60000), socPercent: 50, chargePowerW: 60, dischargePowerW: 0, gridPowerW: null, pvPowerW: null, chargeEnergyWh: 1, dischargeEnergyWh: 0, batteryTemperatureC: index === 500 ? null : 25 }));
  const history = buildMarstekHistory(rows, start, new Date(start.getTime() + 1200 * 60000), 60);
  const gap = history.points.findIndex(point => point.time === rows[500].sampledAt.toISOString());
  assert.ok(gap > 0); assert.equal(history.points[gap].temperature,null);
  assert.equal(history.points[gap-1].temperature,25); assert.equal(history.points[gap+1].temperature,25);
});
