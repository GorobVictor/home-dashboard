import test from "node:test";
import assert from "node:assert/strict";
import { calculateMetrics, type CounterSnapshot } from "./metrics";

const counters = (overrides: Partial<CounterSnapshot> = {}): CounterSnapshot => ({ cpuTotal: BigInt(100), systemCpuTotal: BigInt(1_000), onlineCpus: 4, memoryUsage: BigInt(1000), memoryCache: BigInt(250), memoryLimit: BigInt(2000), networkRx: BigInt(100), networkTx: BigInt(200), blockRead: BigInt(1), blockWrite: BigInt(2), pids: 3, ...overrides });

test("Docker metrics calculate deltas and working memory", () => {
  const result = calculateMetrics(counters({ cpuTotal: BigInt(300), systemCpuTotal: BigInt(1_100), networkRx: BigInt(600), networkTx: BigInt(450) }), counters(), 1_000);
  assert.equal(result.cpuPercent, 800);
  assert.equal(result.memoryWorkingSetBytes, BigInt(750));
  assert.equal(result.memoryPercent, 37.5);
  assert.equal(result.networkRxPerSecond, 500);
  assert.equal(result.networkTxPerSecond, 250);
});

test("Docker metrics do not invent rates across counter resets or long pauses", () => {
  const result = calculateMetrics(counters({ networkRx: BigInt(2), networkTx: BigInt(2) }), counters(), 6 * 60_000);
  assert.equal(result.cpuPercent, null);
  assert.equal(result.networkRxPerSecond, null);
  assert.equal(result.networkTxPerSecond, null);
});
