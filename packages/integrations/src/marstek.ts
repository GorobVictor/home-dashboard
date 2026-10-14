import { createSocket } from "node:dgram";
import { isIP } from "node:net";

export interface MarstekDeviceConfig {
  id: string;
  name: string;
  host: string;
  port: number;
}

export interface MarstekReading {
  sampledAt: Date;
  socPercent: number | null;
  batteryPowerW: number | null;
  powerSource: "reported" | "derived" | "unavailable";
  chargePowerW: number;
  dischargePowerW: number;
  flow: "charging" | "discharging" | "idle" | "unknown";
  gridPowerW: number | null;
  offgridPowerW: number | null;
  pvPowerW: number | null;
  batteryTemperatureC: number | null;
  remainingCapacityWh: number | null;
  ratedCapacityWh: number | null;
  gridInputTotalWh: number | null;
  gridOutputTotalWh: number | null;
  pvTotalWh: number | null;
  loadTotalWh: number | null;
  chargeAllowed: boolean | null;
  dischargeAllowed: boolean | null;
  mode: string | null;
  ctConnected: boolean | null;
  meterPowerW: number | null;
}

type RpcMethod = "ES.GetStatus" | "Bat.GetStatus" | "ES.GetMode";
type RpcResult = Record<string, unknown>;

function record(value: unknown): RpcResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_response");
  }
  return value as RpcResult;
}

function optionalNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error("invalid_measurement");
  }
  return value;
}

function optionalBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "boolean") throw new Error("invalid_measurement");
  return value;
}

export function parseMarstekDevices(value: string | undefined): MarstekDeviceConfig[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length > 32) throw new Error("invalid_marstek_devices");
  const ids = new Set<string>();
  return parsed.map((entry: unknown) => {
    const device = record(entry);
    if (
      typeof device.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(device.id) ||
      typeof device.name !== "string" || !device.name.trim() || device.name.length > 100 ||
      typeof device.host !== "string" || isIP(device.host) !== 4 ||
      typeof device.port !== "number" || !Number.isInteger(device.port) || device.port < 1 || device.port > 65535 ||
      ids.has(device.id)
    ) throw new Error("invalid_marstek_devices");
    ids.add(device.id);
    return { id: device.id, name: device.name.trim(), host: device.host, port: device.port };
  });
}

export class MarstekUdpClient {
  constructor(private readonly timeoutMs = 2_000) {}

  async request(device: MarstekDeviceConfig, method: RpcMethod): Promise<RpcResult> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.requestOnce(device, method);
      } catch (error) {
        if (attempt === 1 || (error instanceof Error && error.message === "device_error")) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw new Error("device_unavailable");
  }

  private requestOnce(device: MarstekDeviceConfig, method: RpcMethod): Promise<RpcResult> {
    return new Promise((resolve, reject) => {
      const socket = createSocket("udp4");
      // Some Venus E firmware ignores large JSON-RPC IDs; calls are serialized per device.
      const requestId = 1;
      const payload = Buffer.from(JSON.stringify({ id: requestId, method, params: { id: 0 } }));
      let finished = false;
      const finish = (error?: Error, result?: RpcResult) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        socket.close();
        if (error) reject(error);
        else resolve(result ?? {});
      };
      const timer = setTimeout(() => finish(new Error("timeout")), this.timeoutMs);
      socket.on("error", () => finish(new Error("socket_error")));
      socket.on("message", (message, remote) => {
        if (remote.address !== device.host || remote.port !== device.port) return;
        if (message.length > 16_384) return finish(new Error("invalid_response"));
        try {
          const response = record(JSON.parse(message.toString("utf8")) as unknown);
          if (response.id !== requestId) return;
          if (response.error !== undefined) return finish(new Error("device_error"));
          finish(undefined, record(response.result));
        } catch {
          finish(new Error("invalid_response"));
        }
      });
      socket.send(payload, device.port, device.host, (error) => {
        if (error) finish(new Error("socket_error"));
      });
    });
  }
}

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function readMarstekDevice(
  device: MarstekDeviceConfig,
  client: Pick<MarstekUdpClient, "request"> = new MarstekUdpClient(),
): Promise<MarstekReading> {
  // The device handles one UDP RPC at a time. Keep requests sequential.
  const es = await client.request(device, "ES.GetStatus");
  await pause(500);
  const battery = await client.request(device, "Bat.GetStatus").catch(() => null);
  await pause(500);
  const modeStatus = await client.request(device, "ES.GetMode").catch(() => null);
  const socPercent = optionalNumber(es.bat_soc, 0, 100) ?? optionalNumber(battery?.soc, 0, 100);
  const gridPowerW = optionalNumber(es.ongrid_power, -20_000, 20_000);
  const offgridPowerW = optionalNumber(es.offgrid_power, -20_000, 20_000);
  const pvPowerW = optionalNumber(es.pv_power, -20_000, 20_000);
  const reportedPower = optionalNumber(es.bat_power, -20_000, 20_000);
  const derivedPower = gridPowerW === null ? null : (pvPowerW ?? 0) - gridPowerW - (offgridPowerW ?? 0);
  const batteryPowerW = reportedPower ?? derivedPower;
  if (socPercent === null && batteryPowerW === null) throw new Error("invalid_response");
  const flow = batteryPowerW === null ? "unknown" : batteryPowerW > 20 ? "charging" : batteryPowerW < -20 ? "discharging" : "idle";
  const mode = modeStatus?.mode;
  return {
    sampledAt: new Date(),
    socPercent,
    batteryPowerW,
    powerSource: reportedPower !== null ? "reported" : derivedPower !== null ? "derived" : "unavailable",
    chargePowerW: Math.max(0, batteryPowerW ?? 0),
    dischargePowerW: Math.max(0, -(batteryPowerW ?? 0)),
    flow,
    gridPowerW,
    offgridPowerW,
    pvPowerW,
    batteryTemperatureC: optionalNumber(battery?.bat_temp, -50, 120),
    remainingCapacityWh: optionalNumber(battery?.bat_capacity, 0, 100_000),
    ratedCapacityWh: optionalNumber(battery?.rated_capacity, 0, 100_000) ?? optionalNumber(es.bat_cap, 0, 100_000),
    gridInputTotalWh: optionalNumber(es.total_grid_input_energy, 0, 1_000_000_000),
    gridOutputTotalWh: optionalNumber(es.total_grid_output_energy, 0, 1_000_000_000),
    pvTotalWh: (() => { const value = optionalNumber(es.total_pv_energy, 0, 100_000_000); return value === null ? null : value * 10; })(),
    loadTotalWh: optionalNumber(es.total_load_energy, 0, 1_000_000_000),
    chargeAllowed: optionalBoolean(battery?.charg_flag),
    dischargeAllowed: optionalBoolean(battery?.dischrg_flag),
    mode: typeof mode === "string" && mode.length <= 32 ? mode : null,
    ctConnected: modeStatus?.ct_state === 1 ? true : modeStatus?.ct_state === 0 ? false : null,
    meterPowerW: optionalNumber(modeStatus?.total_power, -20_000, 20_000),
  };
}
