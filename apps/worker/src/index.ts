import "dotenv/config";
import cron from "node-cron";
import { disconnectDatabase, pruneMarstekMeasurements, syncMarstekDevices } from "@home-dashboard/database";
import { parseMarstekDevices, type MarstekDeviceConfig } from "@home-dashboard/integrations";
import { pollMarstekDevices } from "./jobs/marstek-poll";

const devices = parseMarstekDevices(process.env.MARSTEK_DEVICES);
let pruning = false;
let stopping = false;
const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pollingPromises = new Map<string, Promise<void>>();
let pruningPromise: Promise<void> | undefined;

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

async function main(): Promise<void> {
  await syncMarstekDevices(devices);
  console.info("worker_started", { marstekDevices: devices.length, pollingSeconds: 1 });
  const retentionTask = cron.schedule("17 3 * * *", () => {
    if (!pruning) pruningPromise = pruneOldMeasurements();
  }, { timezone: "UTC" });
  for (const device of devices) schedulePolling(device);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
      if (stopping) return;
      stopping = true;
      for (const timer of pollTimers.values()) clearTimeout(timer);
      retentionTask.stop();
      console.info("worker_stopping", { signal });
      await Promise.allSettled([...pollingPromises.values(), pruningPromise]);
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
