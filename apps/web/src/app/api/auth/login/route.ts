import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, jsonBody, sameOrigin } from "@/server/auth/http";
import { authService } from "@/server/auth/service";
import { reserveLogin } from "@/server/auth/rate-limit";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/server/auth/tokens";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const input = await jsonBody(request);
    const login = input && typeof input === "object" && "login" in input && typeof input.login === "string" ? input.login.slice(0, 50) : "invalid";
    const reservation = reserveLogin(login, request.headers.get("x-internal-client-ip") ?? "local");
    if (reservation.retryAfter) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(reservation.retryAfter) } });
    let user;
    try { user = await authService.login(input); reservation.finish(true); } catch (error) { reservation.finish(false); throw error; }
    const token = await createSessionToken(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(
      sessionCookieName,
      token,
      sessionCookieOptions((request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol).startsWith("https")),
    );
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
