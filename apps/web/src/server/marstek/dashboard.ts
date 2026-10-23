import { listMarstekDevices, listMarstekMeasurementBuckets } from "@home-dashboard/database";
import { buildMarstekHistory, energyAnalytics } from "./history";
import { unstable_cache } from "next/cache";

const historicalSummary = unstable_cache(async (id: string, from: string, to: string) => {
  const start = new Date(from), end = new Date(to);
  const rows = await listMarstekMeasurementBuckets(id, start, 60, end);
  return { ...buildMarstekHistory(rows, start, end, end.getTime() - start.getTime() <= 86400000 ? 60 : 600), analytics: energyAnalytics(rows, start, end), available: rows.some(row => row.chargeEnergyWh !== null) };
}, ["marstek-history-v3"], { revalidate: 60 });
const recentDischarge = unstable_cache(async (id: string, end: number) => {
  const rows = await listMarstekMeasurementBuckets(id, new Date(end - 300000), 60, new Date(end));
  const known = rows.filter(row => row.dischargePowerW !== null);
  return known.length ? known.reduce((sum, row) => sum + (row.dischargePowerW ?? 0), 0) / known.length : null;
}, ["marstek-recent-discharge"], { revalidate: 60 });

export type DashboardRange = 1 | 6 | 24 | 168 | 720;

export async function getMarstekDashboard(deviceId: string | undefined, hours: DashboardRange, from?: Date, to?: Date, liveOnly = false) {
  const devices = await listMarstekDevices();
  const selected = devices.find((device) => device.id === deviceId) ?? devices.find((device) => device.enabled) ?? devices[0];
  const now = Date.now();
  const fresh = (sampledAt: Date | undefined) => Boolean(sampledAt && now - sampledAt.getTime() < 3 * 60_000);
  const deviceCards = devices.map((device) => {
    const latest = device.measurements[0];
    return {
      id: device.id,
      name: device.name,
      enabled: device.enabled,
      online: device.enabled && fresh(latest?.sampledAt),
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      lastError: device.lastError,
      socPercent: latest?.socPercent ?? null,
      flow: latest?.flow ?? "unknown",
      batteryPowerW: latest?.batteryPowerW ?? null,
      chargePowerW: latest?.chargePowerW ?? null,
      dischargePowerW: latest?.dischargePowerW ?? null,
      batteryTemperatureC: latest?.batteryTemperatureC ?? null,
      remainingCapacityWh: latest?.remainingCapacityWh ?? null,
      ratedCapacityWh: latest?.ratedCapacityWh ?? null,
      mode: latest?.mode ?? null,
      ctConnected: latest?.ctConnected ?? null,
      powerSource: latest?.powerSource ?? "unavailable",
    };
  });
  const activeCards = deviceCards.filter((device) => device.online);
  const socCards = activeCards.filter((device) => device.socPercent !== null);
  const roundedNow = Math.floor(now / 60000) * 60000;
  const rangeStart = from ?? new Date(roundedNow - hours * 3_600_000);
  const rangeEnd = to ?? new Date(roundedNow);
  const rangeHours = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 3_600_000));
  const bucketSeconds = rangeHours <= 24 ? 60 : 600;
  const history = selected && !liveOnly ? await historicalSummary(selected.id, rangeStart.toISOString(), rangeEnd.toISOString()) : { ...buildMarstekHistory([], rangeStart, rangeEnd, bucketSeconds), analytics: energyAnalytics([], rangeStart, rangeEnd), available: false };
  const duration = rangeEnd.getTime() - rangeStart.getTime();
  const previousFrom = new Date(Math.max(now - 90 * 864e5, rangeStart.getTime() - duration));
  const previous = selected && !liveOnly && previousFrom < rangeStart ? await historicalSummary(selected.id, previousFrom.toISOString(), rangeStart.toISOString()) : null;
  const previousPeriod = { chargeWh: previous?.period.chargeWh ?? 0, dischargeWh: previous?.period.dischargeWh ?? 0, available: previous?.available ?? false, completeRange: rangeStart.getTime() - previousFrom.getTime() === duration };
  const averageDischargeW = selected && !liveOnly ? await recentDischarge(selected.id, roundedNow) : null;
  const latest = selected?.measurements[0];
  return {
    hours: rangeHours,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    previousPeriod,
    averageDischargeW,
    devices: deviceCards,
    selectedDeviceId: selected?.id ?? null,
    overview: {
      totalDevices: deviceCards.filter((device) => device.enabled).length,
      onlineDevices: activeCards.length,
      chargingW: activeCards.some(device => device.chargePowerW !== null) ? activeCards.reduce((sum, device) => sum + (device.chargePowerW ?? 0), 0) : null,
      dischargingW: activeCards.some(device => device.dischargePowerW !== null) ? activeCards.reduce((sum, device) => sum + (device.dischargePowerW ?? 0), 0) : null,
      averageSoc: socCards.length
        ? socCards.reduce((sum, device) => sum + (device.socPercent ?? 0), 0) / socCards.length
        : null,
    },
    selected: selected ? {
      id: selected.id,
      name: selected.name,
      online: deviceCards.find((device) => device.id === selected.id)?.online ?? false,
      lastSeenAt: selected.lastSeenAt?.toISOString() ?? null,
      latest: latest ? {
        socPercent: latest.socPercent,
        batteryPowerW: latest.batteryPowerW,
        dischargePowerW: latest.dischargePowerW,
        batteryTemperatureC: latest.batteryTemperatureC,
        batteryDetailsAt: latest.batteryDetailsAt?.toISOString() ?? null,
        remainingCapacityWh: latest.remainingCapacityWh,
        ratedCapacityWh: latest.ratedCapacityWh,
        gridPowerW: latest.gridPowerW,
        pvPowerW: latest.pvPowerW,
        offgridPowerW: latest.offgridPowerW,
        mode: latest.mode,
        ctConnected: latest.ctConnected,
        chargeAllowed: latest.chargeAllowed,
        dischargeAllowed: latest.dischargeAllowed,
        gridInputTotalWh: latest.gridInputTotalWh,
        gridOutputTotalWh: latest.gridOutputTotalWh,
        pvTotalWh: latest.pvTotalWh,
        loadTotalWh: latest.loadTotalWh,
        meterPowerW: latest.meterPowerW,
        powerSource: latest.powerSource,
      } : null,
    } : null,
    ...history,
  };
}
