import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessFamilySpace } from "@/lib/families/access";
import { getFamilyRoster } from "@/lib/roster/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ family: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { family } = await context.params;
  if (family !== "memphis") return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canAccessFamilySpace(user, "MEMPHIS")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const roster = await getFamilyRoster("MEMPHIS");
  return NextResponse.json({ roster: roster.map((member) => ({ ...member, totalVoiceSeconds: member.totalVoiceSeconds.toString() })) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
