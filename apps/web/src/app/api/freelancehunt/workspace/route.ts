import { NextRequest } from "next/server";
import { getFreelancehuntWorkspace, updateFreelancehuntWorkspace } from "@home-dashboard/database";
import { parseProjectFilters } from "@home-dashboard/integrations/freelancehunt-rules";
import { freelancehuntRoute, workspaceBody } from "@/server/freelancehunt/http";

export async function GET(request: NextRequest) { return freelancehuntRoute(request, false, getFreelancehuntWorkspace); }
export async function PUT(request: NextRequest) {
  return freelancehuntRoute(request, true, async (userId) => {
    const body = await workspaceBody(request);
    if (Object.keys(body).length !== 1 || !("filters" in body)) throw new Error("invalid_input");
    return updateFreelancehuntWorkspace(userId, { filters: parseProjectFilters(body.filters) });
  });
}
