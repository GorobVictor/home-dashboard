import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { getDatabase, disconnectDatabase } from "./client";
import { saveMarstekReading, syncMarstekDevices, listMarstekMeasurementBuckets } from "./marstek";
import { backfillMarstekMinutes } from "./marstek-aggregates";
import { toMarstekReading } from "@home-dashboard/integrations";
import { saveNotificationChannel, claimNotification, finishNotification } from "./notifications";
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
    await t.test("quiet hours defer without consuming attempts; critical delivery bypasses quiet hours", async () => {
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
    await t.test("a digest channel gets individual projects immediately and an additional summary after 09:00 Kyiv", async () => {
      const channel = await saveNotificationChannel({ name: "Projects and digest", chatId: "-333", enabled: true, minSeverity: "info", sources: ["freelancehunt"], digest: true });
      const event = await publishEvent({ source: "freelancehunt", type: "freelancehunt.project_created", severity: "info", title: "New project", payload: { externalId: 123 }, userIds: [], occurredAt: new Date("2026-10-22T12:00:00Z") });
      const individual = await db.notification.findFirstOrThrow({ where: { eventId: event.id, channelId: channel.id } });
      assert.equal(individual.status, "pending");
      // Work due now is eligible even while the channel's digest is enabled.
      let delivered = false;
      for (let index = 0; index < 10; index++) {
        const work = await claimNotification(new Date("2030-01-02T09:00:00Z"));
        if (!work) break;
        if (work.skipped) continue;
        await finishNotification(work.delivery.id, { messageId: `synthetic-${index}` });
        if (work.notification.id === individual.id) { delivered = true; break; }
      }
      assert.ok(delivered);
      await publishDailyDigests(new Date("2026-10-23T05:59:00Z"));
      const where = { type: "system.daily_digest", deduplicationKey: `digest:${channel.id}:2026-10-22` };
      assert.equal(await db.event.count({ where }), 0);
      await publishDailyDigests(new Date("2026-10-23T06:00:00Z"));
      await publishDailyDigests(new Date("2026-10-23T07:00:00Z"));
      const summary = await db.event.findFirstOrThrow({ where });
      assert.match(String((summary.payload as { summary: string }).summary), /Нових проєктів: 1/);
      assert.equal(await db.event.count({ where }), 1);
      assert.equal(await db.notification.count({ where: { channelId: channel.id } }), 2);
    });
    await t.test("retiring unavailable events cleans saved filters without widening recipients or deleting history", async () => {
      const only = await db.notificationChannel.create({ data: { name: "Retired only", chatId: "-444", eventTypes: ["marstek.grid_lost", "marstek.grid_restored"] } });
      const mixed = await db.notificationChannel.create({ data: { name: "Mixed", chatId: "-445", eventTypes: ["marstek.grid_lost", "freelancehunt.project_created"] } });
      const all = await db.notificationChannel.create({ data: { name: "All", chatId: "-446" } });
      const disabled = await db.notificationChannel.create({ data: { name: "Disabled", chatId: "-447", enabled: false, eventTypes: ["marstek.grid_lost", "marstek.device_offline"] } });
      const event = await publishEvent({ source: "marstek", type: "marstek.grid_lost", severity: "critical", title: "Historical record", telegram: false, userIds: [] });
      const pending = await db.notification.create({ data: { eventId: event.id, recipientKey: `channel:${only.id}`, channelId: only.id } });
      const processing = await db.notification.create({ data: { eventId: event.id, recipientKey: `channel:${mixed.id}`, channelId: mixed.id, status: "processing", leaseUntil: new Date(Date.now() + 120000), attemptCount: 1 } });
      const attempt = await db.notificationDelivery.create({ data: { notificationId: processing.id, attempt: 1, destination: mixed.chatId, status: "processing" } });
      const sent = await db.notification.create({ data: { eventId: event.id, recipientKey: `channel:${all.id}`, channelId: all.id, status: "sent" } });
      const valid = await publishEvent({ source: "freelancehunt", type: "freelancehunt.project_created", severity: "info", title: "Supported project", telegram: false, userIds: [] });
      const validPending = await db.notification.create({ data: { eventId: valid.id, recipientKey: `channel:${mixed.id}`, channelId: mixed.id } });
      await db.eventState.create({ data: { key: "grid:test-battery", value: "offline" } });
      const sql = await readFile(new URL("../prisma/migrations/20261024023000_remove_unimplemented_grid_events/migration.sql", import.meta.url), "utf8");
      const connection = new Client({ connectionString: testUrl });
      await connection.connect();
      try { await connection.query(sql); await connection.query(sql); } finally { await connection.end(); }
      assert.deepEqual((await db.notificationChannel.findUniqueOrThrow({ where: { id: only.id } })).eventTypes, []);
      assert.equal((await db.notificationChannel.findUniqueOrThrow({ where: { id: only.id } })).enabled, false);
      const updated = await db.notificationChannel.findUniqueOrThrow({ where: { id: mixed.id } });
      assert.deepEqual(updated.eventTypes, ["freelancehunt.project_created"]); assert.equal(updated.enabled, true);
      assert.equal((await db.notificationChannel.findUniqueOrThrow({ where: { id: all.id } })).enabled, true);
      assert.equal((await db.notificationChannel.findUniqueOrThrow({ where: { id: disabled.id } })).enabled, false);
      for (const id of [pending.id, processing.id]) assert.equal((await db.notification.findUniqueOrThrow({ where: { id } })).status, "cancelled");
      assert.equal((await db.notificationDelivery.findUniqueOrThrow({ where: { id: attempt.id } })).status, "cancelled");
      assert.equal((await db.notification.findUniqueOrThrow({ where: { id: sent.id } })).status, "sent");
      assert.equal((await db.notification.findUniqueOrThrow({ where: { id: validPending.id } })).status, "pending");
      assert.equal((await db.event.findUniqueOrThrow({ where: { id: event.id } })).title, "Historical record");
      assert.equal(await db.eventState.findUnique({ where: { key: "grid:test-battery" } }), null);
    });
  } finally { await disconnectDatabase(); }
});
