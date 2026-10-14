import { getFreelancehuntSettings, updateFreelancehuntSettings } from "@home-dashboard/database";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";
import { sameOrigin } from "@/server/auth/http";
import { parseFreelancehuntSettings } from "@/server/freelancehunt/settings";

export async function GET() {
  if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getFreelancehuntSettings());
}

export async function PUT(request: NextRequest) {
  if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4096) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    const settings = parseFreelancehuntSettings(JSON.parse(raw) as unknown);
    if (!settings) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return NextResponse.json(await updateFreelancehuntSettings(settings));
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
}
