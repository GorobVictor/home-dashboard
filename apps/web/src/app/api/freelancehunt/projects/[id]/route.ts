import { NextRequest, NextResponse } from "next/server";
import { getStoredFreelancehuntProject, updateFreelancehuntProjectState } from "@home-dashboard/database";
import { FreelancehuntClient } from "@home-dashboard/integrations";
import { parseProjectStatePatch } from "@home-dashboard/integrations/freelancehunt-rules";
import { currentUser } from "@/server/auth/session";
import { freelancehuntRoute, projectId } from "@/server/freelancehunt/http";
import { notificationBody } from "@/server/notifications";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  // Up to 3,000 Unicode characters in a note can exceed the default 4 KiB.
  return freelancehuntRoute(request, true, async (userId) => updateFreelancehuntProjectState(userId, projectId((await context.params).id), parseProjectStatePatch(await notificationBody(request, 16384))));
}
export async function GET(_request: NextRequest, context: Context) {
  if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let id: number;
  try { id = projectId((await context.params).id); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }
  if (!await getStoredFreelancehuntProject(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const token = process.env.FREELANCEHUNT_API_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "freelancehunt_not_configured" }, { status: 503 });
  try {
    const project = await new FreelancehuntClient(token).getProject(id);
    return NextResponse.json(project, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message === "freelancehunt_rate_limited" ? message : "freelancehunt_details_unavailable" }, { status: message === "freelancehunt_rate_limited" ? 429 : message === "freelancehunt_http_404" ? 404 : 502 });
  }
}
