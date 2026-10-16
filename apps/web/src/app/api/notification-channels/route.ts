import { NextRequest } from "next/server";
import { listNotificationChannels, saveNotificationChannel } from "@home-dashboard/database";
import { notificationRoute, notificationBody, parseChannel } from "@/server/notifications";

export async function GET(request: NextRequest) {
  return notificationRoute(request, false, listNotificationChannels);
}
export async function POST(request: NextRequest) {
  return notificationRoute(request, true, async () => saveNotificationChannel(parseChannel(await notificationBody(request))));
}
