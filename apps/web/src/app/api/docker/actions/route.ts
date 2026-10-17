import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";
import { boundedPage, listDockerActions } from "@/server/docker";
export async function GET(request: NextRequest) { if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); const page = boundedPage(request.nextUrl.searchParams.get("page")); if (!page) return NextResponse.json({ error: "invalid_input" }, { status: 400 }); return NextResponse.json(await listDockerActions(page), { headers: { "Cache-Control": "no-store" } }); }
