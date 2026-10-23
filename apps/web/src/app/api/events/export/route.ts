import { NextRequest, NextResponse } from "next/server";
import { exportEvents } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { parseEventFilters, NotificationInputError } from "@/server/notifications";
import { csv } from "@/server/csv";
export async function GET(request: NextRequest) {
  if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const rows = await exportEvents(parseEventFilters(request.nextUrl.searchParams));
    return new Response(csv([["timestamp_utc", "source", "type", "severity", "title"], ...rows.map(row => [row.occurredAt.toISOString(), row.source, row.type, row.severity, row.title])]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="events.csv"', "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof NotificationInputError ? "invalid_input" : "internal_error" }, { status: error instanceof NotificationInputError ? 400 : 500 }); }
}
