import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMarstekHistory } from "./history";

const start = new Date("2026-10-22T00:00:00Z");
const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);
const reading = (minutes: number, chargeEnergyWh = 1) => ({
  sampledAt: at(minutes), socPercent: 80, chargePowerW: 60, dischargePowerW: 0,
  gridPowerW: null, pvPowerW: null, chargeEnergyWh, dischargeEnergyWh: 0,
});

test("a dense day keeps both endpoints and totals from all readings", () => {
  const readings = Array.from({ length: 1440 }, (_, index) => reading(index));
  const history = buildMarstekHistory(readings, start, at(1440), 60);
  assert.ok(history.points.length <= 401);
  assert.equal(history.points[0].time, at(0).toISOString());
  assert.equal(history.points.at(-1)?.time, at(1439).toISOString());
  assert.equal(history.period.chargeWh, 1440);
  assert.equal(history.energy.length, 24);
  assert.ok(history.energy.every((bucket) => bucket.chargeWh === 60));
});

test("outage boundaries survive downsampling and break every plotted series", () => {
  const readings = Array.from({ length: 1000 }, (_, index) => reading(index < 502 ? index : index + 60));
  const history = buildMarstekHistory(readings, start, at(1440), 60);
  const gapIndex = history.points.findIndex((point) => point.charge === null);
  assert.ok(gapIndex > 0);
  assert.equal(history.points[gapIndex - 1].time, at(501).toISOString());
  assert.equal(history.points[gapIndex + 1].time, at(562).toISOString());
  assert.deepEqual(Object.values(history.points[gapIndex]).slice(1), [null, null, null, null, null, null]);
});

test("weekly history preserves missing days and distinguishes missing energy from measured zero", () => {
  const history = buildMarstekHistory([reading(0, 0), reading(10, 0), reading(6 * 1440, 5)], start, at(7 * 1440), 600);
  assert.equal(history.energy.length, 7);
  assert.deepEqual(history.energy.map((bucket) => bucket.chargeWh), [0, null, null, null, null, null, 5]);
  const tenMinutes = history.points.findIndex(point => point.time === at(10).toISOString());
  assert.ok(tenMinutes > 0);
  assert.equal(history.points[tenMinutes + 1].charge, null);
  assert.equal(history.points.at(-1)?.time, at(6 * 1440).toISOString());
  assert.equal(history.energy[6].timestamp - history.energy[0].timestamp, 6 * 864e5);
});

test("partial energy buckets stay inside the selected time range", () => {
  const history = buildMarstekHistory([reading(30), reading(120)], at(30), at(150), 60);
  assert.deepEqual(history.energy.map((bucket) => bucket.timestamp), [at(45).getTime(), at(90).getTime(), at(135).getTime()]);
  assert.deepEqual(history.energy.map((bucket) => bucket.chargeWh), [1, null, 1]);
});

test("an empty period has no invented readings or energy totals", () => {
  const history = buildMarstekHistory([], start, at(1440), 60);
  assert.deepEqual(history.points, []);
  assert.ok(history.energy.every((bucket) => bucket.chargeWh === null && bucket.dischargeWh === null));
  assert.deepEqual(history.period, { chargeWh: 0, dischargeWh: 0 });
});
