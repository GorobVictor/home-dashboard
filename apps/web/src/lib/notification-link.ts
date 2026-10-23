export function notificationLink(event: { type?: string; source?: string; payload?: unknown }): string | null {
  const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {};
  if (event.type === "freelancehunt.project_created" && Number.isSafeInteger(payload.externalId) && Number(payload.externalId) > 0) return `/dashboard?tab=freelancehunt&project=${payload.externalId}`;
  if (event.source === "marstek" && typeof payload.deviceId === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(payload.deviceId)) return `/dashboard?device=${encodeURIComponent(payload.deviceId)}`;
  if (event.source === "freelancehunt" && typeof payload.url === "string") {
    try { const url = new URL(payload.url); if (url.protocol === "https:" && url.hostname === "freelancehunt.com" && !url.username && !url.password) return url.href; } catch { /* No unsafe links. */ }
  }
  return null;
}
