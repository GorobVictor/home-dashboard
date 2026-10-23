import { NextRequest } from "next/server";
import { listSites, saveSite } from "@home-dashboard/database";
import { notificationRoute, notificationBody } from "@/server/notifications";
import { parseSite } from "@/server/sites";
export async function GET(request: NextRequest) { return notificationRoute(request, false, listSites); }
export async function POST(request: NextRequest) { return notificationRoute(request, true, async () => saveSite(parseSite(await notificationBody(request)))); }
