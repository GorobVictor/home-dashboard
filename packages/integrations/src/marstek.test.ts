import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMarstekDevices, readMarstekDevice } from "./marstek";

const device = { id: "venus-e3-1", name: "Venus E3", host: "192.168.3.224", port: 30000 };

test("device configuration supports several distinct local devices", () => {
  const devices = parseMarstekDevices(JSON.stringify([
    device,
    { id: "garage", name: "Garage", host: "192.168.3.225", port: 30000 },
  ]));
  assert.equal(devices.length, 2);
  assert.throws(() => parseMarstekDevices(JSON.stringify([device, device])), /invalid_marstek_devices/);
  assert.throws(() => parseMarstekDevices(JSON.stringify([{ ...device, host: "example.com" }])), /invalid_marstek_devices/);
});

test("reported battery power maps to charging and preserves useful readings", async () => {
  const methods: string[] = [];
  const client = { async request(_device: typeof device, method: "ES.GetStatus" | "Bat.GetStatus" | "ES.GetMode") {
    methods.push(method);
    if (method === "ES.GetStatus") return { bat_soc: 61, bat_power: 750, ongrid_power: -700, pv_power: 50, total_pv_energy: 12 };
    if (method === "Bat.GetStatus") return { bat_temp: 27.5, bat_capacity: 3120, rated_capacity: 5120, charg_flag: true, dischrg_flag: true };
    return { mode: "Auto", ct_state: 1, total_power: 420 };
  } };
  const reading = await readMarstekDevice(device, client);
  assert.deepEqual(methods, ["ES.GetStatus", "Bat.GetStatus", "ES.GetMode"]);
  assert.equal(reading.flow, "charging");
  assert.equal(reading.chargePowerW, 750);
  assert.equal(reading.dischargePowerW, 0);
  assert.equal(reading.powerSource, "reported");
  assert.equal(reading.pvTotalWh, 120);
  assert.equal(reading.batteryTemperatureC, 27.5);
  assert.equal(reading.ctConnected, true);
});

test("missing bat_power is derived from AC power and optional RPC failures do not erase status", async () => {
  const client = { async request(_device: typeof device, method: "ES.GetStatus" | "Bat.GetStatus" | "ES.GetMode") {
    if (method === "ES.GetStatus") return { bat_soc: 68, ongrid_power: 480, offgrid_power: 0, pv_power: 0 };
    throw new Error("timeout");
  } };
  const reading = await readMarstekDevice(device, client);
  assert.equal(reading.flow, "discharging");
  assert.equal(reading.dischargePowerW, 480);
  assert.equal(reading.powerSource, "derived");
  assert.equal(reading.mode, null);
  assert.equal(reading.batteryTemperatureC, null);
});

test("out-of-range and empty status payloads are rejected", async () => {
  const client = { async request() { return { bat_soc: 140 }; } };
  await assert.rejects(readMarstekDevice(device, client), /invalid_measurement/);
  const empty = { async request() { return {}; } };
  await assert.rejects(readMarstekDevice(device, empty), /invalid_response/);
});
