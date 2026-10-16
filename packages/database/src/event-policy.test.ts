import assert from "node:assert/strict";
import { test } from "node:test";
import { batteryState, shouldPublish, acceptsSeverity, retryDelayMs } from "./event-policy";

test("unchanged conditions and initial baselines never publish, transitions do", () => {
  const now = new Date();
  assert.equal(shouldPublish(null, "low", now), false);
  assert.equal(shouldPublish(null, "offline", now, 0, true), true);
  assert.equal(shouldPublish({ value: "low", lastEventAt: null }, "low", now), false);
  assert.equal(shouldPublish({ value: "normal", lastEventAt: null }, "low", now), true);
  assert.equal(shouldPublish({ value: "low", lastEventAt: now }, "normal", now, 60_000), false);
  assert.equal(shouldPublish({ value: "low", lastEventAt: now }, "normal", new Date(now.getTime() + 60_000), 60_000), true);
});

test("battery hysteresis prevents threshold flapping and supports a configured threshold", () => {
  let state = "normal";
  const transitions: string[] = [];
  for (const soc of [30, 20, 21, 19, 24, 25, 24, 20]) {
    const next = batteryState(soc, state);
    if (next !== state) transitions.push(next);
    state = next;
  }
  assert.deepEqual(transitions, ["low", "normal", "low"]);
  assert.equal(batteryState(30, "normal", 30, 35), "low");
  assert.equal(batteryState(34, "low", 30, 35), "low");
});

test("severity filters include higher priorities and retry delays are exponential and bounded", () => {
  assert.equal(acceptsSeverity("warning", "info"), false);
  assert.equal(acceptsSeverity("warning", "critical"), true);
  assert.equal(acceptsSeverity("error", "error"), true);
  assert.deepEqual([1, 2, 3, 4].map((attempt) => retryDelayMs(attempt)), [5000, 10000, 20000, 40000]);
  assert.equal(retryDelayMs(1, 120), 120000);
  assert.equal(retryDelayMs(50), 3600000);
});
