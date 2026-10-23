import { listMarstekDevices, listMarstekMeasurementBuckets } from "@home-dashboard/database";
import { buildMarstekHistory } from "./history";

export type DashboardRange = 1 | 6 | 24 | 168 | 720;

export async function getMarstekDashboard(deviceId: string | undefined, hours: DashboardRange, from?: Date, to?: Date) {
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
      chargePowerW: latest?.chargePowerW ?? 0,
      dischargePowerW: latest?.dischargePowerW ?? 0,
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
  const rangeStart = from ?? new Date(now - hours * 3_600_000);
  const rangeEnd = to ?? new Date(now);
  const rangeHours = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 3_600_000));
  const bucketSeconds = rangeHours <= 24 ? 60 : 600;
  const measurements = selected
    ? await listMarstekMeasurementBuckets(selected.id, rangeStart, bucketSeconds, rangeEnd)
    : [];
  const history = buildMarstekHistory(measurements, rangeStart, rangeEnd, bucketSeconds);
  const latest = selected?.measurements[0];
  return {
    hours: rangeHours,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    devices: deviceCards,
    selectedDeviceId: selected?.id ?? null,
    overview: {
      totalDevices: deviceCards.filter((device) => device.enabled).length,
      onlineDevices: activeCards.length,
      chargingW: activeCards.reduce((sum, device) => sum + device.chargePowerW, 0),
      dischargingW: activeCards.reduce((sum, device) => sum + device.dischargePowerW, 0),
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
