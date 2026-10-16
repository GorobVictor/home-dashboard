import { NextRequest } from "next/server";
import { removeNotificationChannel, saveNotificationChannel } from "@home-dashboard/database";
import { notificationRoute, notificationBody, parseChannel, isUuid, NotificationInputError } from "@/server/notifications";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: NextRequest, context: Context) {
  return notificationRoute(request, true, async () => {
    const { id } = await context.params;
    if (!isUuid(id)) throw new NotificationInputError();
    return saveNotificationChannel(parseChannel(await notificationBody(request)), id);
  });
}
export async function DELETE(request: NextRequest, context: Context) {
  return notificationRoute(request, true, async () => {
    const { id } = await context.params;
    if (!isUuid(id)) throw new NotificationInputError();
    return removeNotificationChannel(id);
  });
}
