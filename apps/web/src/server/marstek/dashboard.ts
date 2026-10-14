import { listMarstekDevices, listMarstekMeasurementBuckets } from "@home-dashboard/database";

export type DashboardRange = 24 | 168;

export async function getMarstekDashboard(deviceId: string | undefined, hours: DashboardRange) {
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
  const measurements = selected
    ? await listMarstekMeasurementBuckets(selected.id, new Date(now - hours * 3_600_000), hours === 24 ? 60 : 600)
    : [];
  const step = Math.max(1, Math.ceil(measurements.length / 400));
  const points = measurements
    .filter((_, index) => index % step === 0 || index === measurements.length - 1)
    .map((item) => ({
      time: item.sampledAt.toISOString(),
      soc: item.socPercent,
      charge: item.chargePowerW,
      discharge: item.dischargePowerW,
      grid: item.gridPowerW,
      pv: item.pvPowerW,
    }));
  const bucketMs = hours === 24 ? 3_600_000 : 24 * 3_600_000;
  const buckets = new Map<number, { chargeWh: number; dischargeWh: number }>();
  for (const item of measurements) {
    const key = Math.floor(item.sampledAt.getTime() / bucketMs) * bucketMs;
    const bucket = buckets.get(key) ?? { chargeWh: 0, dischargeWh: 0 };
    bucket.chargeWh += item.chargeEnergyWh;
    bucket.dischargeWh += item.dischargeEnergyWh;
    buckets.set(key, bucket);
  }
  const energy = [...buckets].map(([time, value]) => ({
    time: new Date(time).toISOString(),
    chargeWh: Math.round(value.chargeWh),
    dischargeWh: Math.round(value.dischargeWh),
  }));
  const latest = selected?.measurements[0];
  return {
    hours,
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
        powerSource: latest.powerSource,
      } : null,
    } : null,
    points,
    energy,
    period: {
      chargeWh: Math.round(measurements.reduce((sum, item) => sum + item.chargeEnergyWh, 0)),
      dischargeWh: Math.round(measurements.reduce((sum, item) => sum + item.dischargeEnergyWh, 0)),
    },
  };
}
