import type { MarstekDeviceConfig, MarstekReading } from "@home-dashboard/integrations";
import { getDatabase } from "./client";

const measurementSelect = {
  sampledAt: true,
  socPercent: true,
  batteryPowerW: true,
  powerSource: true,
  chargePowerW: true,
  dischargePowerW: true,
  chargeEnergyWh: true,
  dischargeEnergyWh: true,
  flow: true,
  gridPowerW: true,
  offgridPowerW: true,
  pvPowerW: true,
  batteryTemperatureC: true,
  remainingCapacityWh: true,
  ratedCapacityWh: true,
  gridInputTotalWh: true,
  gridOutputTotalWh: true,
  pvTotalWh: true,
  loadTotalWh: true,
  chargeAllowed: true,
  dischargeAllowed: true,
  mode: true,
  ctConnected: true,
  meterPowerW: true,
} as const;

export async function syncMarstekDevices(devices: MarstekDeviceConfig[]): Promise<void> {
  const db = getDatabase();
  await db.$transaction([
    ...devices.map((device) => db.marstekDevice.upsert({
      where: { id: device.id },
      create: { ...device, enabled: true },
      update: { name: device.name, host: device.host, port: device.port, enabled: true },
    })),
    db.marstekDevice.updateMany({
      where: { id: { notIn: devices.map((device) => device.id) } },
      data: { enabled: false },
    }),
  ]);
}

export async function saveMarstekReading(deviceId: string, reading: MarstekReading): Promise<void> {
  const db = getDatabase();
  const previous = await db.marstekMeasurement.findFirst({
    where: { deviceId },
    orderBy: { sampledAt: "desc" },
    select: { sampledAt: true, chargePowerW: true, dischargePowerW: true },
  });
  const elapsedMs = previous ? reading.sampledAt.getTime() - previous.sampledAt.getTime() : 0;
  // Do not invent energy across outages or delayed polls.
  const elapsedHours = elapsedMs > 0 && elapsedMs <= 5 * 60_000 ? elapsedMs / 3_600_000 : 0;
  const chargeEnergyWh = previous ? (previous.chargePowerW + reading.chargePowerW) / 2 * elapsedHours : 0;
  const dischargeEnergyWh = previous ? (previous.dischargePowerW + reading.dischargePowerW) / 2 * elapsedHours : 0;
  await db.$transaction([
    db.marstekMeasurement.create({
      data: { deviceId, ...reading, chargeEnergyWh, dischargeEnergyWh },
    }),
    db.marstekDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: reading.sampledAt, lastError: null },
    }),
  ]);
}

export async function markMarstekFailure(deviceId: string, reason: string): Promise<void> {
  await getDatabase().marstekDevice.update({
    where: { id: deviceId },
    data: { lastError: reason.slice(0, 100) },
  });
}

export async function listMarstekDevices() {
  return getDatabase().marstekDevice.findMany({
    orderBy: { name: "asc" },
    include: { measurements: { orderBy: { sampledAt: "desc" }, take: 1, select: measurementSelect } },
  });
}

export async function listMarstekMeasurements(deviceId: string, since: Date) {
  return getDatabase().marstekMeasurement.findMany({
    where: { deviceId, sampledAt: { gte: since } },
    orderBy: { sampledAt: "asc" },
    take: 11_000,
    select: measurementSelect,
  });
}

export async function pruneMarstekMeasurements(before: Date): Promise<number> {
  const result = await getDatabase().marstekMeasurement.deleteMany({
    where: { sampledAt: { lt: before } },
  });
  return result.count;
}
