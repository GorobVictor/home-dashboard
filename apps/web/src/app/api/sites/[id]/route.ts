import { NextRequest } from "next/server";
import { saveSite, removeSite } from "@home-dashboard/database";
import { notificationRoute, notificationBody, isUuid, NotificationInputError } from "@/server/notifications";
import { parseSite } from "@/server/sites";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: NextRequest, context: Context) {
  return notificationRoute(request, true, async () => { const { id } = await context.params; if (!isUuid(id)) throw new NotificationInputError(); return saveSite(parseSite(await notificationBody(request)), id); });
}
export async function DELETE(request: NextRequest, context: Context) {
  return notificationRoute(request, true, async () => { const { id } = await context.params; if (!isUuid(id)) throw new NotificationInputError(); return removeSite(id); });
}
