import { NextRequest } from "next/server";
import { testNotificationChannel } from "@home-dashboard/database";
import { notificationRoute, isUuid, NotificationInputError } from "@/server/notifications";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return notificationRoute(request, true, async (userId) => {
    const { id } = await context.params;
    if (!isUuid(id)) throw new NotificationInputError();
    return { queued: true, event: await testNotificationChannel(id, userId) };
  });
}
