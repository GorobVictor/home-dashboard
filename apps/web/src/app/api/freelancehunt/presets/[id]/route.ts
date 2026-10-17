import { NextRequest } from "next/server";
import { deleteFreelancehuntPreset } from "@home-dashboard/database";
import { isUuid } from "@/server/notifications";
import { freelancehuntRoute } from "@/server/freelancehunt/http";
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return freelancehuntRoute(request, true, async (userId) => {
    const { id } = await context.params;
    if (!isUuid(id)) throw new Error("invalid_input");
    return deleteFreelancehuntPreset(userId, id);
  });
}
