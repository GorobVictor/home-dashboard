import type { listMarstekMeasurementBuckets } from "@home-dashboard/database";

type MarstekMeasurementBucket = Awaited<ReturnType<typeof listMarstekMeasurementBuckets>>[number];

export function buildMarstekHistory(measurements: MarstekMeasurementBucket[], start: Date, end: Date, bucketSeconds: 60 | 600) {
  const step = Math.max(1, Math.ceil(measurements.length / 400));
  const gapMs = Math.max(5 * 60_000, bucketSeconds * 1000);
  const point = (item: MarstekMeasurementBucket) => ({
    time: item.sampledAt.toISOString(),
    soc: item.socPercent,
    charge: item.chargePowerW as number | null,
    discharge: item.dischargePowerW as number | null,
    grid: item.gridPowerW,
    pv: item.pvPowerW,
  });
  const points: ReturnType<typeof point>[] = [];
  for (let index = 0; index < measurements.length; index++) {
    const item = measurements[index];
    const previous = measurements[index - 1];
    const next = measurements[index + 1];
    const gapBefore = previous && item.sampledAt.getTime() - previous.sampledAt.getTime() > gapMs;
    const gapAfter = next && next.sampledAt.getTime() - item.sampledAt.getTime() > gapMs;
    if (gapBefore) {
      points.push({ time: new Date((previous.sampledAt.getTime() + item.sampledAt.getTime()) / 2).toISOString(), soc: null, charge: null, discharge: null, grid: null, pv: null });
    }
    // Keep both sides of outages even when downsampling a dense history.
    if (index % step === 0 || index === measurements.length - 1 || gapBefore || gapAfter) points.push(point(item));
  }

  const energyBucketMs = bucketSeconds === 60 ? 3_600_000 : 24 * 3_600_000;
  const buckets = new Map<number, { chargeWh: number; dischargeWh: number }>();
  for (const item of measurements) {
    const key = Math.floor(item.sampledAt.getTime() / energyBucketMs) * energyBucketMs;
    const bucket = buckets.get(key) ?? { chargeWh: 0, dischargeWh: 0 };
    bucket.chargeWh += item.chargeEnergyWh;
    bucket.dischargeWh += item.dischargeEnergyWh;
    buckets.set(key, bucket);
  }
  const energy = [];
  for (let time = Math.floor(start.getTime() / energyBucketMs) * energyBucketMs; time < end.getTime(); time += energyBucketMs) {
    const bucket = buckets.get(time);
    energy.push({
      time: new Date(time).toISOString(),
      // Center each bar in the visible part of its hour/day.
      timestamp: (Math.max(time, start.getTime()) + Math.min(time + energyBucketMs, end.getTime())) / 2,
      chargeWh: bucket ? Math.round(bucket.chargeWh) : null,
      dischargeWh: bucket ? Math.round(bucket.dischargeWh) : null,
    });
  }
  return { points, energy, period: {
    chargeWh: Math.round(measurements.reduce((sum, item) => sum + item.chargeEnergyWh, 0)),
    dischargeWh: Math.round(measurements.reduce((sum, item) => sum + item.dischargeEnergyWh, 0)),
  } };
}
