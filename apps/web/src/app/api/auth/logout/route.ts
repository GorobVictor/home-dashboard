import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth/http";
import { sessionCookieName, sessionCookieOptions } from "@/server/auth/tokens";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    ...sessionCookieOptions(request.nextUrl.protocol === "https:"),
    maxAge: 0,
  });
  return response;
}
