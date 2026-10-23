import { NextRequest, NextResponse } from "next/server";
import { severities, notificationEventTypes, type NotificationEventType, type ChannelInput, type EventFilters, type Severity } from "@home-dashboard/database";
import { currentUser } from "./auth/session";
import { sameOrigin } from "./auth/http";
import { readJson } from "./body";

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export class NotificationInputError extends Error {}

export async function notificationRoute(request: NextRequest, mutate: boolean, action: (userId: string) => Promise<unknown>) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (mutate && !sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json(await action(user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NotificationInputError) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    if (error instanceof Error && error.message === "test_rate_limited") return NextResponse.json({ error: "test_rate_limited" }, { status: 429 });
    if (error instanceof Error && error.message === "channel_disabled") return NextResponse.json({ error: "channel_disabled" }, { status: 409 });
    if (error instanceof Error && error.message === "resource_limit") return NextResponse.json({ error: "resource_limit" }, { status: 409 });
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "P2002") return NextResponse.json({ error: "channel_already_exists" }, { status: 409 });
    if (code === "P2025") return NextResponse.json({ error: "not_found" }, { status: 404 });
    console.error("notification_request_failed", { code: "internal_error" });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function notificationBody(request: NextRequest, limit = 4096): Promise<Record<string, unknown>> {
  try {
    const body = await readJson(request, limit);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new NotificationInputError();
    return body as Record<string, unknown>;
  } catch { throw new NotificationInputError(); }
}

export function parseChannel(body: Record<string, unknown>): ChannelInput {
  if (Object.keys(body).some((key) => !["name", "chatId", "enabled", "minSeverity", "sources", "eventTypes", "deviceIds", "quietFrom", "quietTo", "digest"].includes(key)) || typeof body.name !== "string" || !body.name.trim() || body.name.length > 100 || typeof body.chatId !== "string" || !/^(-?\d{1,20}|@[a-zA-Z][a-zA-Z0-9_]{4,31})$/.test(body.chatId) || typeof body.enabled !== "boolean" || !severities.includes(body.minSeverity as Severity) || !Array.isArray(body.sources) || body.sources.length > 3 || body.sources.some((source) => !["marstek", "freelancehunt", "system"].includes(String(source)))) throw new NotificationInputError();
  for (const key of ["eventTypes", "deviceIds"] as const) if (key in body && (!Array.isArray(body[key]) || body[key].length > 32 || body[key].some((value: unknown) => typeof value !== "string" || !(key === "deviceIds" ? /^[a-z0-9][a-z0-9_-]{0,63}$/ : /^[a-z][a-z0-9_.-]{0,99}$/).test(value)))) throw new NotificationInputError();
  if (Array.isArray(body.eventTypes) && body.eventTypes.some(value => !notificationEventTypes.includes(value as NotificationEventType))) throw new NotificationInputError();
  for (const key of ["quietFrom", "quietTo"] as const) if (key in body && (typeof body[key] !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/.test(body[key]))) throw new NotificationInputError();
  if (Boolean(body.quietFrom) !== Boolean(body.quietTo) || ("digest" in body && typeof body.digest !== "boolean")) throw new NotificationInputError();
  return { name: body.name.trim(), chatId: body.chatId, enabled: body.enabled, minSeverity: body.minSeverity as Severity, sources: [...new Set(body.sources as string[])], ...("eventTypes" in body ? { eventTypes: [...new Set(body.eventTypes as string[])] } : {}), ...("deviceIds" in body ? { deviceIds: [...new Set(body.deviceIds as string[])] } : {}), ...("quietFrom" in body ? { quietFrom: body.quietFrom as string, quietTo: body.quietTo as string } : {}), ...("digest" in body ? { digest: body.digest as boolean } : {}) };
}

export function pageNumber(params: URLSearchParams) {
  const raw = params.get("page") ?? "1";
  if (!/^\d{1,5}$/.test(raw) || Number(raw) < 1 || Number(raw) > 10000) throw new NotificationInputError();
  return Number(raw);
}

export function parseEventFilters(params: URLSearchParams): EventFilters {
  const result: EventFilters = { page: pageNumber(params) };
  for (const key of ["source", "type"] as const) {
    const value = params.get(key);
    if (value) {
      if (!/^[a-z][a-z0-9_.-]{0,99}$/.test(value) || (key === "source" && value.length > 64)) throw new NotificationInputError();
      result[key] = value;
    }
  }
  const severity = params.get("severity");
  if (severity) { if (!severities.includes(severity as Severity)) throw new NotificationInputError(); result.severity = severity as Severity; }
  for (const key of ["from", "to"] as const) {
    const value = params.get(key);
    if (!value) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new NotificationInputError();
    const date = new Date(`${value}T${key === "from" ? "00:00:00.000" : "23:59:59.999"}Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new NotificationInputError();
    result[key] = date;
  }
  if (result.from && result.to && result.from > result.to) throw new NotificationInputError();
  return result;
}
