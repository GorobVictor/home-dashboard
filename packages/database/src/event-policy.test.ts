import assert from "node:assert/strict";
import { test } from "node:test";
import { batteryState, shouldPublish, acceptsSeverity, retryDelayMs, marstekAvailabilityState } from "./event-policy";

const at = (seconds: number) => new Date(Date.UTC(2026, 9, 23) + seconds * 1000);
type Availability = ReturnType<typeof marstekAvailabilityState>;
function observe(state: Availability | null, available: boolean, seconds: number) {
  return marstekAvailabilityState(state, available, at(seconds));
}

test("a failed poll after host sleep does not report offline then online", () => {
  let state = observe(null, true, 0);
  state = observe(state, false, 3600);
  assert.equal(state.value, "online");
  assert.equal(state.candidateSinceAt?.getTime(), at(3600).getTime());
  state = observe(state, true, 3602);
  assert.equal(state.value, "online");
  assert.equal(state.candidateSinceAt, null);
});

test("offline requires three minutes of observed failures, including a never-seen device", () => {
  let state = observe(null, false, 0);
  for (let seconds = 1; seconds < 180; seconds++) {
    state = observe(state, false, seconds);
    assert.equal(state.value, "online");
  }
  state = observe(state, false, 180);
  assert.equal(state.value, "offline");
  assert.equal(state.candidateValue, null);
  assert.equal(observe(state, false, 181).value, "offline");
});

test("a successful poll resets the pending outage", () => {
  let state = observe(null, true, 0);
  for (let seconds = 1; seconds <= 179; seconds++) state = observe(state, false, seconds);
  state = observe(state, true, 180);
  state = observe(state, false, 181);
  assert.equal(state.value, "online");
  assert.equal(state.candidateSinceAt?.getTime(), at(181).getTime());
});

test("recovery requires thirty seconds of successes and a failed probe restarts confirmation", () => {
  let state: Availability = { value: "offline", candidateValue: null, candidateSinceAt: null, lastObservedAt: at(0) };
  for (let seconds = 1; seconds <= 20; seconds++) state = observe(state, true, seconds);
  assert.equal(state.value, "offline");
  state = observe(state, false, 21);
  for (let seconds = 22; seconds < 52; seconds++) {
    state = observe(state, true, seconds);
    assert.equal(state.value, "offline");
  }
  assert.equal(observe(state, true, 52).value, "online");
});

test("long observation gaps and a backwards clock restart either pending transition", () => {
  for (const available of [true, false]) {
    const initial: Availability = { value: available ? "offline" : "online", candidateValue: null, candidateSinceAt: null, lastObservedAt: at(0) };
    let state = observe(initial, available, 1);
    state = observe(state, available, 3600);
    assert.equal(state.value, initial.value);
    assert.equal(state.candidateSinceAt?.getTime(), at(3600).getTime());
    state = observe(state, available, 10);
    assert.equal(state.value, initial.value);
    assert.equal(state.candidateSinceAt?.getTime(), at(10).getTime());
  }
});

test("legacy persisted availability starts confirmation without replaying an event", () => {
  const legacy: Availability = { value: "offline", candidateValue: null, candidateSinceAt: null, lastObservedAt: null };
  const state = observe(legacy, true, 3600);
  assert.equal(state.value, "offline");
  assert.equal(state.candidateSinceAt?.getTime(), at(3600).getTime());
});

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
