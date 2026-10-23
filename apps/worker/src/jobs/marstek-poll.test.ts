import assert from "node:assert/strict";
import { test } from "node:test";
import type { MarstekReading } from "@home-dashboard/integrations";
import { pollMarstekDevices, type PollOperations } from "./marstek-poll";

test("one failed battery does not prevent another battery from being stored", async () => {
  const stored: string[] = [];
  const failures: string[] = [];
  const reading = { sampledAt: new Date("2026-10-14T18:00:00Z"), flow: "charging" } as MarstekReading;
  const operations: PollOperations = {
    async read(device) {
      if (device.id === "failed") throw new Error("timeout");
      return reading;
    },
    async save(deviceId) { stored.push(deviceId); },
    async fail(deviceId, reason) { failures.push(`${deviceId}:${reason}`); },
  };
  await pollMarstekDevices([
    { id: "failed", name: "Failed", host: "192.168.3.225", port: 30000 },
    { id: "working", name: "Working", host: "192.168.3.224", port: 30000 },
  ], operations);
  assert.deepEqual(stored, ["working"]);
  assert.deepEqual(failures, ["failed:timeout"]);
});

test("a database write failure never marks a responding device unavailable or blocks another device", async (t) => {
  const stored: string[] = [];
  const failures: string[] = [];
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  await pollMarstekDevices([
    { id: "write-failed", name: "Write failed", host: "192.168.3.225", port: 30000 },
    { id: "saved", name: "Saved", host: "192.168.3.224", port: 30000 },
  ], {
    async read() { return { sampledAt: new Date(), flow: "idle" } as MarstekReading; },
    async save(deviceId) {
      if (deviceId === "write-failed") throw new Error("private_database_details");
      stored.push(deviceId);
    },
    async fail(deviceId) { failures.push(deviceId); },
  });
  assert.deepEqual(stored, ["saved"]);
  assert.deepEqual(failures, []);
  assert.equal(logs[0][0], "marstek_measurement_save_failed");
  assert.ok(!JSON.stringify(logs).includes("private_database_details"));
});

test("a failure while recording an unreachable device does not stop the next device", async (t) => {
  t.mock.method(console, "error", () => {});
  const stored: string[] = [];
  await pollMarstekDevices([
    { id: "unreachable", name: "Unreachable", host: "192.168.3.225", port: 30000 },
    { id: "reachable", name: "Reachable", host: "192.168.3.224", port: 30000 },
  ], {
    async read(device) {
      if (device.id === "unreachable") throw new Error("timeout");
      return { sampledAt: new Date(), flow: "idle" } as MarstekReading;
    },
    async save(deviceId) { stored.push(deviceId); },
    async fail() { throw new Error("database_unavailable"); },
  });
  assert.deepEqual(stored, ["reachable"]);
});
