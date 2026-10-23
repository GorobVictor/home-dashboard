import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";
import { getMarstekDashboard } from "@/server/marstek/dashboard";

export async function GET(request: NextRequest) {
  try {
    if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const id = request.nextUrl.searchParams.get("device") ?? undefined;
    if (id && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    const { devices, selected, overview } = await getMarstekDashboard(id, 1, undefined, undefined, true);
    return NextResponse.json({ devices, selected, overview }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "internal_error" }, { status: 500 }); }
}
