import { NextRequest } from "next/server";
import { saveFreelancehuntPreset } from "@home-dashboard/database";
import { parseProjectFilters } from "@home-dashboard/integrations/freelancehunt-rules";
import { freelancehuntRoute, workspaceBody } from "@/server/freelancehunt/http";

export async function POST(request: NextRequest) {
  return freelancehuntRoute(request, true, async (userId) => {
    const body = await workspaceBody(request);
    if (Object.keys(body).some((key) => !["name", "filters"].includes(key)) || typeof body.name !== "string" || !body.name.trim() || body.name.length > 100) throw new Error("invalid_input");
    return saveFreelancehuntPreset(userId, body.name.trim(), parseProjectFilters(body.filters));
  });
}
