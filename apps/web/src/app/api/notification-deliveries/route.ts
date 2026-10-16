import { NextRequest } from "next/server";
import { listNotificationDeliveries } from "@home-dashboard/database";
import { notificationRoute, pageNumber, isUuid, NotificationInputError } from "@/server/notifications";

export async function GET(request: NextRequest) {
  return notificationRoute(request, false, () => {
    const id = request.nextUrl.searchParams.get("channelId") ?? undefined;
    if (id && !isUuid(id)) throw new NotificationInputError();
    return listNotificationDeliveries(id, pageNumber(request.nextUrl.searchParams));
  });
}
