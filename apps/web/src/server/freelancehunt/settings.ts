import type { FreelancehuntSettingsInput } from "@home-dashboard/database";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function parseFreelancehuntSettings(value: unknown): FreelancehuntSettingsInput | null {
  const input = record(value);
  if (!input) return null;
  const enabled = boolean(input.enabled);
  const projectPollingEnabled = boolean(input.projectPollingEnabled);
  const messagePollingEnabled = boolean(input.messagePollingEnabled);
  const telegramEnabled = boolean(input.telegramEnabled);
  const pollIntervalSeconds = input.pollIntervalSeconds;
  const rawSkills = input.skillIds;
  if (
    enabled === null || projectPollingEnabled === null || messagePollingEnabled === null || telegramEnabled === null ||
    !Number.isInteger(pollIntervalSeconds) || typeof pollIntervalSeconds !== "number" || pollIntervalSeconds < 10 || pollIntervalSeconds > 3600 ||
    !Array.isArray(rawSkills) || rawSkills.length > 50 || rawSkills.some((id) => !Number.isInteger(id) || typeof id !== "number" || id < 1 || id > 1_000_000)
  ) return null;
  return { enabled, projectPollingEnabled, messagePollingEnabled, telegramEnabled, pollIntervalSeconds, skillIds: [...new Set(rawSkills)] };
}
