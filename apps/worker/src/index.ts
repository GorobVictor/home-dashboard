import "dotenv/config";
import cron from "node-cron";
import { disconnectDatabase, getFreelancehuntSettings, pruneMarstekMeasurements, syncMarstekDevices, initializeLegacyTelegramChannel, getDockerMonitoringSettings, rollupDockerMetrics, pruneDockerMonitoring } from "@home-dashboard/database";
import { parseMarstekDevices, type MarstekDeviceConfig } from "@home-dashboard/integrations";
import { pollMarstekDevices } from "./jobs/marstek-poll";
import { pollFreelancehunt } from "./jobs/freelancehunt-poll";
import { processNotifications } from "./jobs/notification-delivery";
import { pollDockerContainers } from "./jobs/docker-poll";
import { startDockerControlServer } from "./docker-control";

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
let dockerTimer: ReturnType<typeof setTimeout> | undefined;
let dockerPromise: Promise<void> | undefined;
let dockerControlServer: import("node:http").Server | undefined;

function scheduleDockerPolling(delayMs = 1_000): void {
  if (stopping || process.env.DOCKER_MONITORING_ENABLED !== "true") return;
  dockerTimer = setTimeout(async () => {
    const startedAt = Date.now();
    dockerPromise = pollDockerContainers().then(() => undefined).finally(async () => {
      if (!stopping) { const settings = await getDockerMonitoringSettings().catch(() => ({ pollIntervalSeconds: 60 })); scheduleDockerPolling(Math.max(5_000, settings.pollIntervalSeconds * 1_000 - (Date.now() - startedAt))); }
    });
    await dockerPromise;
  }, delayMs);
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
    const removed = await pruneMarstekMeasurements(before);
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
      await pollFreelancehunt({
        enabled: settings.enabled,
        projectPollingEnabled: settings.projectPollingEnabled,
        messagePollingEnabled: settings.messagePollingEnabled,
        telegramEnabled: settings.telegramEnabled,
        pollIntervalSeconds: settings.pollIntervalSeconds,
        skillIds: settings.skillIds as number[],
        projectsInitialized: settings.projectsInitialized,
        messagesInitialized: settings.messagesInitialized,
      });
      const nextDelay = Math.max(5_000, settings.pollIntervalSeconds * 1_000 - (Date.now() - startedAt));
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
  const legacyChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (legacyChatId && /^(-?\d{1,20}|@[a-zA-Z][a-zA-Z0-9_]{4,31})$/.test(legacyChatId)) await initializeLegacyTelegramChannel(legacyChatId);
  console.info("worker_started", { marstekDevices: devices.length, pollingSeconds: 1 });
  const retentionTask = cron.schedule("17 3 * * *", () => {
    if (!pruning) pruningPromise = pruneOldMeasurements();
  }, { timezone: "UTC" });
  for (const device of devices) schedulePolling(device);
  scheduleFreelancehuntPolling();
  scheduleNotifications();
  scheduleDockerPolling();
  dockerControlServer = startDockerControlServer();
  const dockerRollupTask = cron.schedule("0 * * * *", () => { void rollupDockerMetrics().catch(() => console.error("docker_rollup_failed")); }, { timezone: "UTC" });
  const dockerRetentionTask = cron.schedule("27 3 * * *", () => { void rollupDockerMetrics().then(pruneDockerMonitoring).catch(() => console.error("docker_retention_failed")); }, { timezone: "UTC" });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
      if (stopping) return;
      stopping = true;
      for (const timer of pollTimers.values()) clearTimeout(timer);
      if (freelancehuntTimer) clearTimeout(freelancehuntTimer);
      if (notificationTimer) clearTimeout(notificationTimer);
      if (dockerTimer) clearTimeout(dockerTimer);
      retentionTask.stop();
      dockerRollupTask.stop();
      dockerRetentionTask.stop();
      await new Promise<void>((resolve) => dockerControlServer?.close(() => resolve()) ?? resolve());
      console.info("worker_stopping", { signal });
      await Promise.allSettled([...pollingPromises.values(), pruningPromise, freelancehuntPromise, notificationPromise, dockerPromise]);
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
