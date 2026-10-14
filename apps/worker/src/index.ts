import "dotenv/config";
import cron from "node-cron";
import { disconnectDatabase, pruneMarstekMeasurements, syncMarstekDevices } from "@home-dashboard/database";
import { parseMarstekDevices } from "@home-dashboard/integrations";
import { pollMarstekDevices } from "./jobs/marstek-poll";

const devices = parseMarstekDevices(process.env.MARSTEK_DEVICES);
let polling = false;
let pruning = false;
let stopping = false;
let pollingPromise: Promise<void> | undefined;
let pruningPromise: Promise<void> | undefined;

async function runPolling(): Promise<void> {
  if (polling || stopping) return;
  polling = true;
  try {
    await pollMarstekDevices(devices);
  } finally {
    polling = false;
  }
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
  console.info("worker_started", { marstekDevices: devices.length, pollingSeconds: 60 });
  const pollTask = cron.schedule("* * * * *", () => {
    if (!polling) pollingPromise = runPolling();
  }, { timezone: "UTC" });
  const retentionTask = cron.schedule("17 3 * * *", () => {
    if (!pruning) pruningPromise = pruneOldMeasurements();
  }, { timezone: "UTC" });
  pollingPromise = runPolling();

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
      if (stopping) return;
      stopping = true;
      pollTask.stop();
      retentionTask.stop();
      console.info("worker_stopping", { signal });
      await Promise.allSettled([pollingPromise, pruningPromise]);
      await disconnectDatabase();
      process.exit(0);
    });
  }
}

main().catch(async (error) => {
  console.error("worker_start_failed", { error: error instanceof Error ? error.name : "unknown_error" });
  await disconnectDatabase();
  process.exitCode = 1;
});
