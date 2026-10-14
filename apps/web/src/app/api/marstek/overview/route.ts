import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";
import { getMarstekDashboard } from "@/server/marstek/dashboard";

export async function GET(request: NextRequest) {
  try {
    if (!await currentUser()) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const hoursValue = request.nextUrl.searchParams.get("hours") ?? "24";
    const deviceId = request.nextUrl.searchParams.get("device") ?? undefined;
    if ((hoursValue !== "24" && hoursValue !== "168") || (deviceId && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(deviceId))) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    return NextResponse.json(await getMarstekDashboard(deviceId, Number(hoursValue) as 24 | 168));
  } catch (error) {
    console.error("Marstek overview failed", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
