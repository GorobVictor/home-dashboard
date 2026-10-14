import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, jsonBody, sameOrigin } from "@/server/auth/http";
import { authService } from "@/server/auth/service";
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
    const user = await authService.login(await jsonBody(request));
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
