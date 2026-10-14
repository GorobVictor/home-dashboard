import { markMarstekFailure, saveMarstekReading } from "@home-dashboard/database";
import { readMarstekDevice } from "@home-dashboard/integrations";
import type { MarstekDeviceConfig, MarstekReading } from "@home-dashboard/integrations";

export interface PollOperations {
  read(device: MarstekDeviceConfig): Promise<MarstekReading>;
  save(deviceId: string, reading: MarstekReading): Promise<void>;
  fail(deviceId: string, reason: string): Promise<void>;
}

const defaultOperations: PollOperations = {
  read: readMarstekDevice,
  save: saveMarstekReading,
  fail: markMarstekFailure,
};

export async function pollMarstekDevices(
  devices: MarstekDeviceConfig[],
  operations: PollOperations = defaultOperations,
): Promise<void> {
  async function pollDevice(device: MarstekDeviceConfig) {
    try {
      const reading = await operations.read(device);
      await operations.save(device.id, reading);
      console.info("marstek_poll_success", { deviceId: device.id, flow: reading.flow, sampledAt: reading.sampledAt.toISOString() });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error";
      console.error("marstek_poll_failed", { deviceId: device.id, reason });
      try {
        await operations.fail(device.id, reason);
      } catch (databaseError) {
        console.error("marstek_failure_save_failed", { deviceId: device.id, error: databaseError instanceof Error ? databaseError.name : "unknown_error" });
      }
    }
  }

  for (let index = 0; index < devices.length; index += 4) {
    await Promise.all(devices.slice(index, index + 4).map(pollDevice));
  }
}
