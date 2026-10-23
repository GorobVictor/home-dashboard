export const severities = ["info", "warning", "error", "critical"] as const;
export type Severity = typeof severities[number];

// Only events with active producers may be selected in channel filters.
// Tests and daily digests use their dedicated delivery controls instead.
export const notificationEventTypes = [
  "marstek.battery_low", "marstek.battery_recovered", "marstek.fully_charged",
  "marstek.device_offline", "marstek.device_online",
  "freelancehunt.project_created", "freelancehunt.message_received",
  "system.service_unavailable", "system.service_restored",
] as const;
export type NotificationEventType = typeof notificationEventTypes[number];

export const marstekAvailabilityPolicy = {
  offlineAfterMs: 180_000,
  recoveryAfterMs: 30_000,
  maxObservationGapMs: 30_000,
} as const;

interface AvailabilityState {
  value: string;
  candidateValue: string | null;
  candidateSinceAt: Date | null;
  lastObservedAt: Date | null;
}

export function marstekAvailabilityState(previous: AvailabilityState | null, available: boolean, now: Date): AvailabilityState {
  const value = previous?.value === "offline" ? "offline" : "online";
  const observed = available ? "online" : "offline";
  const cleared = { candidateValue: null, candidateSinceAt: null, lastObservedAt: now };
  if (value === observed) return { value, ...cleared };

  const elapsed = previous?.lastObservedAt ? now.getTime() - previous.lastObservedAt.getTime() : -1;
  const continuous = previous?.candidateValue === observed && previous.candidateSinceAt
    && elapsed >= 0 && elapsed <= marstekAvailabilityPolicy.maxObservationGapMs
    && previous.candidateSinceAt <= now;
  const since = continuous ? previous.candidateSinceAt! : now;
  const threshold = available ? marstekAvailabilityPolicy.recoveryAfterMs : marstekAvailabilityPolicy.offlineAfterMs;
  if (now.getTime() - since.getTime() >= threshold) return { value: observed, ...cleared };
  return { value, candidateValue: observed, candidateSinceAt: since, lastObservedAt: now };
}

export function acceptsSeverity(minimum: Severity, severity: Severity): boolean {
  return severities.indexOf(severity) >= severities.indexOf(minimum);
}

export function shouldPublish(previous: { value: string; lastEventAt: Date | null } | null, value: string, now: Date, cooldownMs = 0, emitInitial = false): boolean {
  if (!previous) return emitInitial;
  return previous.value !== value && (!previous.lastEventAt || now.getTime() - previous.lastEventAt.getTime() >= cooldownMs);
}

export function batteryState(soc: number, previous: string | undefined, low = 20, recovery = 25): string {
  if (soc <= low) return "low";
  if (previous === "low" && soc < recovery) return "low";
  return "normal";
}

export function retryDelayMs(attempt: number, retryAfterSeconds = 0): number {
  return Math.max(Math.min(3_600_000, 5_000 * 2 ** Math.max(0, attempt - 1)), Math.min(86_400, Math.max(0, retryAfterSeconds)) * 1_000);
}
