import "dotenv/config";
import cron from "node-cron";
import { disconnectDatabase, getFreelancehuntSettings, pruneMarstekMeasurements, syncMarstekDevices, initializeLegacyTelegramChannel, backfillMarstekMinutes, recordHealth, publishDailyDigests } from "@home-dashboard/database";
import { parseMarstekDevices, type MarstekDeviceConfig } from "@home-dashboard/integrations";
import { pollMarstekDevices } from "./jobs/marstek-poll";
import { pollFreelancehunt } from "./jobs/freelancehunt-poll";
import { processNotifications } from "./jobs/notification-delivery";

const devices = parseMarstekDevices(process.env.MARSTEK_DEVICES);
let pruning = false;
let stopping = false;
const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pollingPromises = new Map<string, Promise<void>>();
let pruningPromise: Promise<void> | undefined;
let freelancehuntTimer: ReturnType<typeof setTimeout> | undefined;
let freelancehuntPromise: Promise<void> | undefined;
let notificationTimer: ReturnType<typeof setTimeout> | undefined;
let notificationPromise: Promise<void> | undefined;
let maintenanceTimer: ReturnType<typeof setTimeout> | undefined;
let maintenancePromise: Promise<void> | undefined;
let lastDigestCheck = 0;

function scheduleMaintenance(): void {
  if (stopping) return;
  maintenanceTimer = setTimeout(() => {
    maintenancePromise = (async () => {
      await recordHealth("worker", true);
      await backfillMarstekMinutes();
      if (Date.now() - lastDigestCheck > 15 * 60000) { await publishDailyDigests(); lastDigestCheck = Date.now(); }
    })().catch(() => console.error("maintenance_failed", { code: "database_failure" })).finally(scheduleMaintenance);
  }, 5000);
}

function scheduleNotifications(): void {
  if (stopping) return;
  notificationTimer = setTimeout(() => {
    notificationPromise = processNotifications().catch(() => console.error("notification_processing_failed", { code: "database_or_delivery_failure" })).finally(scheduleNotifications);
  }, 2_000);
}

function schedulePolling(device: MarstekDeviceConfig): void {
  if (stopping) return;
  const startedAt = Date.now();
  const promise = pollMarstekDevices([device])
    .catch((error) => {
      console.error("marstek_poll_job_failed", { deviceId: device.id, error: error instanceof Error ? error.name : "unknown_error" });
    })
    .finally(() => {
      if (!stopping) {
        pollTimers.set(device.id, setTimeout(() => schedulePolling(device), Math.max(0, 1_000 - (Date.now() - startedAt))));
      }
    });
  pollingPromises.set(device.id, promise);
}

async function pruneOldMeasurements(): Promise<void> {
  if (pruning || stopping) return;
  pruning = true;
  try {
    const before = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let removed = 0;
    while (!stopping) {
      const batch = await pruneMarstekMeasurements(before); removed += batch;
      if (batch < 200000) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.info("marstek_retention_complete", { removed });
  } catch (error) {
    console.error("marstek_retention_failed", { error: error instanceof Error ? error.name : "unknown_error" });
  } finally {
    pruning = false;
  }
}

function scheduleFreelancehuntPolling(delayMs = 1_000): void {
  if (stopping) return;
  freelancehuntTimer = setTimeout(async () => {
    const startedAt = Date.now();
    freelancehuntPromise = (async () => {
      try {
      const settings = await getFreelancehuntSettings();
      const backoff = await pollFreelancehunt({
        enabled: settings.enabled,
        projectPollingEnabled: settings.projectPollingEnabled,
        messagePollingEnabled: settings.messagePollingEnabled,
        telegramEnabled: settings.telegramEnabled,
        pollIntervalSeconds: settings.pollIntervalSeconds,
        skillIds: settings.skillIds as number[],
        projectsInitialized: settings.projectsInitialized,
        messagesInitialized: settings.messagesInitialized,
      });
      const nextDelay = Math.max(5_000, backoff, settings.pollIntervalSeconds * 1_000 - (Date.now() - startedAt));
      scheduleFreelancehuntPolling(nextDelay);
      } catch (error) {
        console.error("freelancehunt_poll_failed", { error: error instanceof Error ? error.message : "unknown_error" });
        scheduleFreelancehuntPolling(60_000);
      }
    })();
    await freelancehuntPromise;
  }, delayMs);
}

async function main(): Promise<void> {
  await syncMarstekDevices(devices);
  pruningPromise = pruneOldMeasurements();
  const legacyChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (legacyChatId && /^(-?\d{1,20}|@[a-zA-Z][a-zA-Z0-9_]{4,31})$/.test(legacyChatId)) await initializeLegacyTelegramChannel(legacyChatId);
  console.info("worker_started", { marstekDevices: devices.length, pollingSeconds: 1 });
  const retentionTask = cron.schedule("17 3 * * *", () => {
    if (!pruning) pruningPromise = pruneOldMeasurements();
  }, { timezone: "UTC" });
  for (const device of devices) schedulePolling(device);
  scheduleFreelancehuntPolling();
  scheduleNotifications();
  scheduleMaintenance();

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
      if (stopping) return;
      stopping = true;
      for (const timer of pollTimers.values()) clearTimeout(timer);
      if (freelancehuntTimer) clearTimeout(freelancehuntTimer);
      if (notificationTimer) clearTimeout(notificationTimer);
      if (maintenanceTimer) clearTimeout(maintenanceTimer);
      retentionTask.stop();
      console.info("worker_stopping", { signal });
      await Promise.allSettled([...pollingPromises.values(), pruningPromise, freelancehuntPromise, notificationPromise, maintenancePromise]);
      await disconnectDatabase();
      process.exit(0);
    });
  }
}

main().catch(async (error) => {
  const code = error !== null && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
  console.error("worker_start_failed", { error: error instanceof Error ? error.name : "unknown_error", code });
  await disconnectDatabase();
  process.exitCode = 1;
});
