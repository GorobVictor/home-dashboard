import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";
import { sameOrigin } from "@/server/auth/http";
import { notificationBody, NotificationInputError } from "@/server/notifications";

// Keyword/category selections are bounded at 16 KiB.
export const workspaceBody = (request: NextRequest) => notificationBody(request, 16384);
export function projectId(value: string) {
  if (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647) throw new Error("invalid_input");
  return Number(value);
}
export async function freelancehuntRoute(request: NextRequest, mutate: boolean, action: (userId: string) => Promise<unknown>) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (mutate && !sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json(await action(user.id), { headers: { "Cache-Control": "no-store" } });
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    const status = error instanceof NotificationInputError || message === "invalid_input" ? 400 : message === "not_found" || code === "P2025" ? 404 : message === "preset_limit" ? 409 : 500;
    if (status === 500) console.error("freelancehunt_request_failed", { code: "internal_error" });
    return NextResponse.json({ error: status === 500 ? "internal_error" : status === 400 ? "invalid_input" : status === 404 ? "not_found" : "preset_limit" }, { status });
  }
}
