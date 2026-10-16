import { NextRequest } from "next/server";
import { listEvents } from "@home-dashboard/database";
import { notificationRoute, parseEventFilters } from "@/server/notifications";

export async function GET(request: NextRequest) {
  return notificationRoute(request, false, () => listEvents(parseEventFilters(request.nextUrl.searchParams)));
}
