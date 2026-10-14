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
