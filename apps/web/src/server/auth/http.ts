import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "./service";
import { readJson } from "../body";

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0] ?? request.nextUrl.protocol.slice(0, -1);
    return parsed.host === host && parsed.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

export async function jsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await readJson(request);
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
