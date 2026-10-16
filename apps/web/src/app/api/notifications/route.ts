import { NextRequest } from "next/server";
import { listNotifications } from "@home-dashboard/database";
import { notificationRoute, pageNumber, NotificationInputError } from "@/server/notifications";

export async function GET(request: NextRequest) {
  return notificationRoute(request, false, (userId) => {
    const unread = request.nextUrl.searchParams.get("unread");
    if (unread && !["true", "false"].includes(unread)) throw new NotificationInputError();
    return listNotifications(userId, pageNumber(request.nextUrl.searchParams), unread === "true");
  });
}
