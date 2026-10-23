import { Prisma } from "../generated/client/client";
import type { MarstekReading } from "@home-dashboard/integrations";
import { getDatabase } from "./client";

const metrics = [
  ["soc", "soc_percent"], ["charge", "charge_power_w"], ["discharge", "discharge_power_w"],
  ["grid", "grid_power_w"], ["pv", "pv_power_w"], ["temperature", "battery_temperature_c"],
] as const;
const aggregateColumns = metrics.flatMap(([name, column]) => [
  Prisma.sql`coalesce(sum(${Prisma.raw(column)}), 0)::float8 AS ${Prisma.raw(`"${name}Sum"`)}`,
  Prisma.sql`count(${Prisma.raw(column)})::int AS ${Prisma.raw(`"${name}Count"`)}`,
]);
function rawMinutes(where: Prisma.Sql) {
  return Prisma.sql`SELECT device_id AS "deviceId", date_trunc('minute', sampled_at) AS "bucketAt",
    count(*)::int AS samples, min(sampled_at) AS "firstAt", max(sampled_at) AS "lastAt",
    ${Prisma.join(aggregateColumns)},
    min(battery_temperature_c)::float8 AS "temperatureMin", max(battery_temperature_c)::float8 AS "temperatureMax",
    max(charge_power_w)::float8 AS "chargePeak", max(discharge_power_w)::float8 AS "dischargePeak",
    coalesce(sum(charge_energy_wh),0)::float8 AS "chargeEnergyWh", coalesce(sum(discharge_energy_wh),0)::float8 AS "dischargeEnergyWh",
    count(charge_energy_wh)::int AS "energyCount",
    least(60, count(charge_power_w) * 1.0)::float8 AS "coverageSeconds"
    FROM marstek_measurements WHERE ${where} GROUP BY device_id, date_trunc('minute', sampled_at)`;
}
export async function saveMarstekMinute(tx: Prisma.TransactionClient, deviceId: string, reading: MarstekReading, chargeEnergyWh: number | null, dischargeEnergyWh: number | null, coverageSeconds: number) {
  const bucketAt = new Date(Math.floor(reading.sampledAt.getTime() / 60000) * 60000);
  if (!await tx.marstekMinute.findUnique({ where: { deviceId_bucketAt: { deviceId, bucketAt } }, select: { samples: true } })) {
    await tx.$executeRaw(Prisma.sql`INSERT INTO marstek_minutes ${rawMinutes(Prisma.sql`device_id = ${deviceId} AND sampled_at >= ${bucketAt} AND sampled_at < ${new Date(bucketAt.getTime() + 60000)}`)} ON CONFLICT DO NOTHING`);
    return;
  }
  const values = [reading.socPercent, reading.chargePowerW, reading.dischargePowerW, reading.gridPowerW, reading.pvPowerW, reading.batteryTemperatureC];
  const fields = metrics.flatMap(([name]) => [`${name}Sum`, `${name}Count`]);
  const amounts = values.flatMap(value => [value ?? 0, value === null ? 0 : 1]);
  const columns = ["deviceId", "bucketAt", "samples", "firstAt", "lastAt", ...fields, "temperatureMin", "temperatureMax", "chargePeak", "dischargePeak", "chargeEnergyWh", "dischargeEnergyWh", "energyCount", "coverageSeconds"];
  const entries = [deviceId, new Date(Math.floor(reading.sampledAt.getTime() / 60000) * 60000), 1, reading.sampledAt, reading.sampledAt, ...amounts, reading.batteryTemperatureC, reading.batteryTemperatureC, reading.chargePowerW, reading.dischargePowerW, chargeEnergyWh ?? 0, dischargeEnergyWh ?? 0, chargeEnergyWh === null ? 0 : 1, coverageSeconds];
  const additions = ["samples", ...fields, "chargeEnergyWh", "dischargeEnergyWh", "energyCount", "coverageSeconds"].map(name => Prisma.raw(`"${name}" = marstek_minutes."${name}" + EXCLUDED."${name}"`));
  const extrema = ["firstAt", "temperatureMin"].map(name => Prisma.raw(`"${name}" = least(marstek_minutes."${name}", EXCLUDED."${name}")`));
  for (const name of ["lastAt", "temperatureMax", "chargePeak", "dischargePeak"]) extrema.push(Prisma.raw(`"${name}" = greatest(marstek_minutes."${name}", EXCLUDED."${name}")`));
  await tx.$executeRaw(Prisma.sql`INSERT INTO marstek_minutes (${Prisma.join(columns.map(name => Prisma.raw(`"${name}"`)))})
    VALUES (${Prisma.join(entries)}) ON CONFLICT ("deviceId","bucketAt") DO UPDATE SET ${Prisma.join([...additions, ...extrema])}`);
}

// One bounded hour per pass; checkpoint survives worker restarts.
export async function backfillMarstekMinutes() {
  const db = getDatabase();
  const key = "marstek:aggregate-backfill";
  const state = await db.eventState.findUnique({ where: { key } });
  const earliest = state ? new Date(state.value) : (await db.marstekMeasurement.findFirst({ orderBy: { sampledAt: "asc" }, select: { sampledAt: true } }))?.sampledAt;
  if (!earliest) return;
  const from = new Date(Math.floor(earliest.getTime() / 3600000) * 3600000);
  const until = new Date(Math.min(from.getTime() + 3600000, Math.floor((Date.now() - 300000) / 60000) * 60000));
  if (until <= from) return;
  await db.$transaction(async tx => {
    await tx.$executeRaw(Prisma.sql`INSERT INTO marstek_minutes ${rawMinutes(Prisma.sql`sampled_at >= ${from} AND sampled_at < ${until}`)} ON CONFLICT DO NOTHING`);
    await tx.eventState.upsert({ where: { key }, create: { key, value: until.toISOString() }, update: { value: until.toISOString() } });
  }, { timeout: 30000 });
}

export interface MarstekMeasurementBucket {
  sampledAt: Date; firstAt?: Date; lastAt?: Date;
  socPercent: number | null; chargePowerW: number | null; dischargePowerW: number | null;
  gridPowerW: number | null; pvPowerW: number | null; batteryTemperatureC?: number | null;
  chargeEnergyWh: number | null; dischargeEnergyWh: number | null;
  samples?: number; coverageSeconds?: number; chargePeak?: number | null; dischargePeak?: number | null;
}
export async function measurementBuckets(deviceId: string, since: Date, until: Date) {
  const db = getDatabase();
  // Only complete minutes use rollups. Edges and not-yet-backfilled history use bounded raw rows.
  const fullStart = new Date(Math.ceil(since.getTime() / 60000) * 60000);
  const fullEnd = new Date(Math.floor(until.getTime() / 60000) * 60000);
  const raw = rawMinutes(Prisma.sql`device_id = ${deviceId} AND sampled_at >= greatest(gap, ${since}) AND sampled_at < gap + interval '1 minute' AND sampled_at <= ${until}`);
  return db.$queryRaw<MarstekMeasurementBucket[]>(Prisma.sql`WITH gaps AS (
    SELECT gap FROM generate_series(date_trunc('minute', ${since}::timestamptz), date_trunc('minute', ${until}::timestamptz), interval '1 minute') gap
    WHERE gap < ${fullStart} OR gap >= ${fullEnd} OR NOT EXISTS
      (SELECT 1 FROM marstek_minutes m WHERE m."deviceId" = ${deviceId} AND m."bucketAt" = gap)
  ), minutes AS (
    SELECT * FROM marstek_minutes WHERE "deviceId" = ${deviceId} AND "bucketAt" >= ${fullStart} AND "bucketAt" < ${fullEnd}
    UNION ALL SELECT r.* FROM gaps CROSS JOIN LATERAL (${raw}) r
  ) SELECT greatest("bucketAt", ${since}) AS "sampledAt", "firstAt", "lastAt",
    "socSum"/nullif("socCount",0) AS "socPercent", "chargeSum"/nullif("chargeCount",0) AS "chargePowerW",
    "dischargeSum"/nullif("dischargeCount",0) AS "dischargePowerW",
    "gridSum"/nullif("gridCount",0) AS "gridPowerW", "pvSum"/nullif("pvCount",0) AS "pvPowerW",
    "temperatureSum"/nullif("temperatureCount",0) AS "batteryTemperatureC",
    CASE WHEN "energyCount">0 THEN "chargeEnergyWh" END AS "chargeEnergyWh",
    CASE WHEN "energyCount">0 THEN "dischargeEnergyWh" END AS "dischargeEnergyWh",
    samples, least(60,"coverageSeconds") AS "coverageSeconds", "chargePeak", "dischargePeak"
    FROM minutes ORDER BY "bucketAt"`);
}
