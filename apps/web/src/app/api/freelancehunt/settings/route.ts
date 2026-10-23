import { getFreelancehuntSettings, updateFreelancehuntSettings } from "@home-dashboard/database";
import { NextRequest } from "next/server";
import { parseFreelancehuntSettings } from "@/server/freelancehunt/settings";
import { notificationRoute, notificationBody, NotificationInputError } from "@/server/notifications";

export async function GET(request: NextRequest) {
  return notificationRoute(request, false, getFreelancehuntSettings);
}
export async function PUT(request: NextRequest) {
  return notificationRoute(request, true, async () => {
    const settings = parseFreelancehuntSettings(await notificationBody(request));
    if (!settings) throw new NotificationInputError();
    return updateFreelancehuntSettings(settings);
  });
}
