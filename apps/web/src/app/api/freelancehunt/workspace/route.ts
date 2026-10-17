import { NextRequest } from "next/server";
import { getFreelancehuntWorkspace, updateFreelancehuntWorkspace } from "@home-dashboard/database";
import { parseProjectFilters, parseScoringProfile } from "@home-dashboard/integrations/freelancehunt-rules";
import { freelancehuntRoute, workspaceBody } from "@/server/freelancehunt/http";

export async function GET(request: NextRequest) { return freelancehuntRoute(request, false, getFreelancehuntWorkspace); }
export async function PUT(request: NextRequest) {
  return freelancehuntRoute(request, true, async (userId) => {
    const body = await workspaceBody(request);
    if (!Object.keys(body).length || Object.keys(body).some((key) => !["filters", "scoring", "notificationMinScore"].includes(key))) throw new Error("invalid_input");
    const threshold = body.notificationMinScore;
    if (threshold !== undefined && (typeof threshold !== "number" || !Number.isInteger(threshold) || threshold < 0 || threshold > 100)) throw new Error("invalid_input");
    return updateFreelancehuntWorkspace(userId, { ...(body.filters === undefined ? {} : { filters: parseProjectFilters(body.filters) }), ...(body.scoring === undefined ? {} : { scoring: parseScoringProfile(body.scoring) }), ...(threshold === undefined ? {} : { notificationMinScore: threshold as number }) });
  });
}
