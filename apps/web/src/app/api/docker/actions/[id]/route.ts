import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";
import { actionId, getDockerAction } from "@/server/docker";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); const { id } = await params; if (!actionId(id)) return NextResponse.json({ error: "invalid_input" }, { status: 400 }); const action = await getDockerAction(id); return action ? NextResponse.json(action, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "not_found" }, { status: 404 }); }
