import type { listMarstekMeasurementBuckets } from "@home-dashboard/database";

type MarstekMeasurementBucket = Awaited<ReturnType<typeof listMarstekMeasurementBuckets>>[number];
const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Kyiv" });

export function buildMarstekHistory(measurements: MarstekMeasurementBucket[], start: Date, end: Date, bucketSeconds: 60 | 600) {
  const step = Math.max(1, Math.ceil(measurements.length / 400));
  const gapMs = 5 * 60_000;
  const point = (item: MarstekMeasurementBucket) => ({
    time: item.sampledAt.toISOString(),
    soc: item.socPercent,
    charge: item.chargePowerW as number | null,
    discharge: item.dischargePowerW as number | null,
    grid: item.gridPowerW,
    pv: item.pvPowerW,
    temperature: item.batteryTemperatureC ?? null,
  });
  const points: ReturnType<typeof point>[] = [];
  for (let index = 0; index < measurements.length; index++) {
    const item = measurements[index];
    const previous = measurements[index - 1];
    const next = measurements[index + 1];
    const gapBefore = previous && (item.firstAt ?? item.sampledAt).getTime() - (previous.lastAt ?? previous.sampledAt).getTime() > gapMs;
    const gapAfter = next && (next.firstAt ?? next.sampledAt).getTime() - (item.lastAt ?? item.sampledAt).getTime() > gapMs;
    const values = point(item);
    const changes = (neighbor: MarstekMeasurementBucket | undefined) => {
      if (!neighbor) return false;
      const other = point(neighbor);
      return (["soc", "charge", "discharge", "grid", "pv", "temperature"] as const).some(key => (values[key] === null) !== (other[key] === null));
    };
    if (gapBefore) {
      points.push({ time: new Date((previous.sampledAt.getTime() + item.sampledAt.getTime()) / 2).toISOString(), soc: null, charge: null, discharge: null, grid: null, pv: null, temperature: null });
    }
    // Keep both sides of outages even when downsampling a dense history.
    if (index % step === 0 || index === measurements.length - 1 || gapBefore || gapAfter || changes(previous) || changes(next)) points.push(values);
  }

  const energyBucketMs = bucketSeconds === 60 ? 3_600_000 : 24 * 3_600_000;
  const buckets = new Map<number, { chargeWh: number; dischargeWh: number; known: boolean }>();
  for (const item of measurements) {
    const key = Math.floor(item.sampledAt.getTime() / energyBucketMs) * energyBucketMs;
    const bucket = buckets.get(key) ?? { chargeWh: 0, dischargeWh: 0, known: false };
    bucket.chargeWh += item.chargeEnergyWh ?? 0;
    bucket.dischargeWh += item.dischargeEnergyWh ?? 0;
    bucket.known ||= item.chargeEnergyWh !== null;
    buckets.set(key, bucket);
  }
  const energy = [];
  for (let time = Math.floor(start.getTime() / energyBucketMs) * energyBucketMs; time < end.getTime(); time += energyBucketMs) {
    const bucket = buckets.get(time);
    energy.push({
      time: new Date(time).toISOString(),
      // Center each bar in the visible part of its hour/day.
      timestamp: (Math.max(time, start.getTime()) + Math.min(time + energyBucketMs, end.getTime())) / 2,
      chargeWh: bucket?.known ? Math.round(bucket.chargeWh) : null,
      dischargeWh: bucket?.known ? Math.round(bucket.dischargeWh) : null,
    });
  }
  return { points, energy, period: {
    chargeWh: Math.round(measurements.reduce((sum, item) => sum + (item.chargeEnergyWh ?? 0), 0)),
    dischargeWh: Math.round(measurements.reduce((sum, item) => sum + (item.dischargeEnergyWh ?? 0), 0)),
  } };
}

export function energyAnalytics(measurements: MarstekMeasurementBucket[], start: Date, end: Date) {
  const coverageSeconds = measurements.reduce((sum, item) => sum + (item.coverageSeconds ?? 0), 0);
  const durationSeconds = Math.max(1, (end.getTime() - start.getTime()) / 1000);
  const temperatures = measurements.flatMap(item => item.batteryTemperatureC == null ? [] : [item.batteryTemperatureC]);
  const days = new Map<string, { date: string; chargeWh: number; dischargeWh: number; coverageSeconds: number; known: boolean }>();
  for (const item of measurements) {
    const date = dayFormat.format(item.sampledAt);
    const day = days.get(date) ?? { date, chargeWh: 0, dischargeWh: 0, coverageSeconds: 0, known: false };
    day.chargeWh += item.chargeEnergyWh ?? 0; day.dischargeWh += item.dischargeEnergyWh ?? 0; day.coverageSeconds += item.coverageSeconds ?? 0;
    day.known ||= item.chargeEnergyWh !== null;
    days.set(date, day);
  }
  return { coveragePercent: Math.min(100, coverageSeconds / durationSeconds * 100),
    chargePeak: measurements.some(item => item.chargePowerW !== null) ? measurements.reduce((peak, item) => Math.max(peak, item.chargePeak ?? item.chargePowerW ?? 0), 0) : null,
    dischargePeak: measurements.some(item => item.dischargePowerW !== null) ? measurements.reduce((peak, item) => Math.max(peak, item.dischargePeak ?? item.dischargePowerW ?? 0), 0) : null,
    minTemperature: temperatures.length ? temperatures.reduce((min, value) => Math.min(min, value), Infinity) : null,
    maxTemperature: temperatures.length ? temperatures.reduce((max, value) => Math.max(max, value), -Infinity) : null,
    days: [...days.values()] };
}
