import { FreelancehuntClient } from "@home-dashboard/integrations";
import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";

export async function GET() {
  if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = process.env.FREELANCEHUNT_API_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "freelancehunt_not_configured" }, { status: 503 });
  try {
    const skills = await new FreelancehuntClient(token).listSkills();
    return NextResponse.json(skills, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("freelancehunt_skills_failed", { error: error instanceof Error ? error.message : "unknown_error" });
    return NextResponse.json({ error: "freelancehunt_unavailable" }, { status: 502 });
  }
}
