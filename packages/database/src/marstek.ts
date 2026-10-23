import type { MarstekDeviceConfig, MarstekReading } from "@home-dashboard/integrations";
import { getDatabase } from "./client";
import { observeMarstekAvailability, observeMarstek } from "./events";
import { saveMarstekMinute, measurementBuckets } from "./marstek-aggregates";
export type { MarstekMeasurementBucket } from "./marstek-aggregates";

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
  batteryDetailsAt: true,
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
  const elapsedHours = elapsedMs > 0 && elapsedMs <= 5 * 60_000 ? elapsedMs / 3_600_000 : null;
  const chargeEnergyWh = elapsedHours !== null && previous?.chargePowerW != null && reading.chargePowerW !== null ? (previous.chargePowerW + reading.chargePowerW) / 2 * elapsedHours : null;
  const dischargeEnergyWh = elapsedHours !== null && previous?.dischargePowerW != null && reading.dischargePowerW !== null ? (previous.dischargePowerW + reading.dischargePowerW) / 2 * elapsedHours : null;
  await db.$transaction(async (tx) => {
    await tx.marstekMeasurement.create({
      data: { deviceId, ...reading, chargeEnergyWh, dischargeEnergyWh },
    });
    await saveMarstekMinute(tx, deviceId, reading, chargeEnergyWh, dischargeEnergyWh, reading.batteryPowerW === null ? 0 : 1);
    await tx.marstekDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: reading.sampledAt, lastError: null },
    });
    await observeMarstek(tx, deviceId, reading.socPercent, reading.sampledAt);
    await tx.$executeRaw`SELECT pg_notify('home_dashboard_events', ${JSON.stringify({ type: "marstek.measurement.saved", deviceId, sampledAt: reading.sampledAt.toISOString() })})`;
  });
}

export async function markMarstekFailure(deviceId: string, reason: string): Promise<void> {
  await getDatabase().$transaction(async (tx) => {
    await tx.marstekDevice.update({
      where: { id: deviceId },
      data: { lastError: reason.slice(0, 100) },
    });
    await observeMarstekAvailability(tx, deviceId, false);
  });
}

export async function listMarstekDevices() {
  return getDatabase().marstekDevice.findMany({
    orderBy: { name: "asc" },
    include: { measurements: { orderBy: { sampledAt: "desc" }, take: 1, select: measurementSelect } },
  });
}

export async function listMarstekMeasurementBuckets(deviceId: string, since: Date, bucketSeconds: 60 | 600, until = new Date()) {
  void bucketSeconds;
  return measurementBuckets(deviceId, since, until);
}

export async function pruneMarstekMeasurements(before: Date): Promise<number> {
  const db = getDatabase();
  let removed = 0;
  for (let batch = 0; batch < 20; batch++) {
    const count = await db.$executeRaw`DELETE FROM marstek_measurements WHERE id IN (SELECT id FROM marstek_measurements WHERE sampled_at < ${before} ORDER BY sampled_at LIMIT 10000)`;
    removed += count;
    if (count < 10000) break;
  }
  await db.marstekMinute.deleteMany({ where: { bucketAt: { lt: before } } });
  return removed;
}
