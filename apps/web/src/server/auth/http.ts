import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "./service";

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function jsonBody(request: NextRequest): Promise<unknown> {
  if (
    !request.headers.get("content-type")?.startsWith("application/json") ||
    Number(request.headers.get("content-length") || 0) > 4096
  ) {
    throw new AuthError("invalid_input");
  }
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 4096) {
      throw new AuthError("invalid_input");
    }
    return JSON.parse(body) as unknown;
  } catch {
    throw new AuthError("invalid_input");
  }
}

export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    const status = error.code === "invalid_credentials" ? 401 : 400;
    return NextResponse.json({ error: error.code }, { status });
  }
  console.error("Authentication request failed", error instanceof Error ? error.name : "unknown_error");
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}
