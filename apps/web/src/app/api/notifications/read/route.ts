import { NextRequest } from "next/server";
import { markNotificationsRead } from "@home-dashboard/database";
import { notificationRoute, notificationBody, isUuid, NotificationInputError } from "@/server/notifications";

export async function POST(request: NextRequest) {
  return notificationRoute(request, true, async (userId) => {
    const body = await notificationBody(request);
    if (body.all !== true && (typeof body.id !== "string" || !isUuid(body.id))) throw new NotificationInputError();
    return { updated: await markNotificationsRead(userId, body.all === true ? undefined : body.id as string) };
  });
}
