import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Session lookup failed", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
