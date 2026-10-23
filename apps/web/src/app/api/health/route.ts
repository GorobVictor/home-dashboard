import { NextResponse } from "next/server";
import { hasUsers } from "@home-dashboard/database";
export async function GET() {
  try { await hasUsers(); return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ status: "unavailable" }, { status: 503 }); }
}
