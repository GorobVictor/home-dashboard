import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";
import { getDockerStatus } from "@/server/docker";
export async function GET() { if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); return NextResponse.json(await getDockerStatus(), { headers: { "Cache-Control": "no-store" } }); }
