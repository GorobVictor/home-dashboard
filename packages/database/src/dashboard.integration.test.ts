import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabase, disconnectDatabase } from "./client";
import { saveMarstekReading, syncMarstekDevices, listMarstekMeasurementBuckets } from "./marstek";
import { backfillMarstekMinutes } from "./marstek-aggregates";
import { toMarstekReading } from "@home-dashboard/integrations";
import { saveNotificationChannel, claimNotification } from "./notifications";
import { publishEvent } from "./events";
import { publishDailyDigests } from "./digests";
import { listSites, saveSite, removeSite } from "./sites";

const testUrl = process.env.DASHBOARD_TEST_DATABASE_URL;
test("PostgreSQL minute aggregates, unknown power, channel policy, digest and shared links", { skip: !testUrl }, async t => {
  assert.match(new URL(testUrl!).pathname, /_dashboard_test$/);
  process.env.DATABASE_URL = testUrl;
  const db = getDatabase(), device = { id: "test-battery", name: "Test", host: "127.0.0.1", port: 30000 };
  try {
    await syncMarstekDevices([device]);
    await t.test("minute aggregates preserve weighted metrics, null energy and exact range bounds", async () => {
      await saveMarstekReading(device.id, toMarstekReading({ bat_soc: 50, bat_power: -60 }, { bat_temp: 25 }, null, new Date("2026-10-22T12:00:00Z")));
      await saveMarstekReading(device.id, toMarstekReading({ bat_soc: 51, bat_power: -120 }, { bat_temp: 27 }, null, new Date("2026-10-22T12:00:01Z")));
      const rows = await listMarstekMeasurementBuckets(device.id, new Date("2026-10-22T12:00:00Z"), 60, new Date("2026-10-22T12:01:00Z"));
      assert.equal(rows.length, 1); assert.equal(rows[0].batteryTemperatureC, 26); assert.equal(rows[0].dischargePowerW, 90);
      assert.ok(Math.abs(rows[0].dischargeEnergyWh! - 0.025) < 0.000001);
      const partial = await listMarstekMeasurementBuckets(device.id, new Date("2026-10-22T12:00:01Z"), 60, new Date("2026-10-22T12:00:02Z"));
      assert.equal(partial[0].socPercent, 51);
      await saveMarstekReading(device.id, toMarstekReading({ bat_soc: 50 }, null, null, new Date("2026-10-22T12:02:00Z")));
      const unknown = await listMarstekMeasurementBuckets(device.id, new Date("2026-10-22T12:02:00Z"), 60, new Date("2026-10-22T12:03:00Z"));
      assert.equal(unknown[0].chargePowerW, null); assert.equal(unknown[0].chargeEnergyWh, null);
      await backfillMarstekMinutes();
      const again = await listMarstekMeasurementBuckets(device.id, new Date("2026-10-22T12:00:00Z"), 600, new Date("2026-10-22T12:01:00Z"));
      assert.equal(again[0].samples, 2);
    });
    await t.test("quiet hours defer without consuming attempts; critical delivery bypasses batching", async () => {
      await saveNotificationChannel({ name: "Night", chatId: "-111", enabled: true, minSeverity: "info", sources: ["system"], quietFrom: "22:00", quietTo: "08:00" });
      await publishEvent({ source: "system", type: "system.test_warning", severity: "warning", title: "Warning", userIds: [] });
      const now = new Date("2030-01-01T22:00:00Z"), work = await claimNotification(now);
      assert.ok(work?.skipped);
      assert.equal((await db.notification.findFirstOrThrow()).attemptCount, 0);
      await saveNotificationChannel({ name: "Digest", chatId: "-222", enabled: true, minSeverity: "info", sources: ["system"], digest: true, quietFrom: "22:00", quietTo: "08:00" });
      const critical = await publishEvent({ source: "system", type: "system.test_critical", severity: "critical", title: "Critical", userIds: [] });
      assert.equal(await db.notification.count({ where: { eventId: critical.id } }), 2);
      const immediate = await claimNotification(now);
      assert.ok(immediate && !immediate.skipped); assert.equal(immediate.notification.eventId, critical.id);
    });
    await t.test("daily digests deduplicate after restarts and link CRUD stays shared", async () => {
      await publishDailyDigests(new Date("2026-10-23T10:00:00Z"));
      await publishDailyDigests(new Date("2026-10-23T11:00:00Z"));
      assert.equal(await db.event.count({ where: { type: "system.daily_digest" } }), 1);
      assert.equal((await listSites()).length, 7);
      const site = await saveSite({ name: "Test", url: "https://example.com/", description: "Test", group: "Tests", position: 1 });
      assert.equal((await listSites()).length, 8);
      await removeSite(site.id); assert.equal((await listSites()).length, 7);
    });
  } finally { await disconnectDatabase(); }
});
