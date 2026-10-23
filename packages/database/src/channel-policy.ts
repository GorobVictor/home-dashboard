import { acceptsSeverity, type Severity } from "./event-policy";

export interface ChannelRules { minSeverity: Severity; sources: unknown; eventTypes?: unknown; deviceIds?: unknown; quietFrom?: string; quietTo?: string; digest?: boolean }
export function channelMatches(channel: ChannelRules, event: { type: string; source: string; severity: Severity; payload?: unknown }) {
  const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {};
  return acceptsSeverity(channel.minSeverity, event.severity)
    && (!Array.isArray(channel.sources) || !channel.sources.length || channel.sources.includes(event.source))
    && (!Array.isArray(channel.eventTypes) || !channel.eventTypes.length || channel.eventTypes.includes(event.type))
    && (!Array.isArray(channel.deviceIds) || !channel.deviceIds.length || channel.deviceIds.includes(payload.deviceId));
}
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function nextDeliveryAt(channel: Pick<ChannelRules, "quietFrom" | "quietTo">, now: Date, severity: Severity) {
  const from = channel.quietFrom, to = channel.quietTo;
  if (severity === "critical" || !from || !to || from === to) return now;
  const quiet = (date: Date) => { const time = clock.format(date); return from < to ? time >= from && time < to : time >= from || time < to; };
  if (!quiet(now)) return now;
  // Walk real UTC minutes, so both missing and repeated DST hours work correctly.
  for (let minutes = 1; minutes <= 1500; minutes++) { const next = new Date(Math.floor(now.getTime() / 60000) * 60000 + minutes * 60000); if (!quiet(next)) return next; }
  return new Date(now.getTime() + 86400000);
}
