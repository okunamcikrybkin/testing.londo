import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

const LIMIT = 10;

export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(request: NextRequest): boolean {
  const expected = process.env.LONDO_BOT_API_SECRET;
  const value = request.headers.get("x-londo-bot-secret");
  if (!expected || !value) return false;
  const expectedBuffer = Buffer.from(expected); const valueBuffer = Buffer.from(value);
  return expectedBuffer.length === valueBuffer.length && timingSafeEqual(expectedBuffer, valueBuffer);
}

type Entry = { balance: { comparedTo(value: unknown): number; toString(): string }; discordUserId: string; totalVoiceSeconds: bigint };

function byCoins(left: Entry, right: Entry): number {
  return right.balance.comparedTo(left.balance) || (right.totalVoiceSeconds > left.totalVoiceSeconds ? 1 : right.totalVoiceSeconds < left.totalVoiceSeconds ? -1 : left.discordUserId.localeCompare(right.discordUserId));
}
function byVoice(left: Entry, right: Entry): number {
  return right.totalVoiceSeconds > left.totalVoiceSeconds ? 1 : right.totalVoiceSeconds < left.totalVoiceSeconds ? -1 : right.balance.comparedTo(left.balance) || left.discordUserId.localeCompare(right.discordUserId);
}
function serialize(entry: Entry) { return { balance: entry.balance.toString(), discordUserId: entry.discordUserId, totalVoiceSeconds: entry.totalVoiceSeconds.toString() }; }

export async function GET(request: NextRequest) {
  if (!process.env.LONDO_BOT_API_SECRET) return NextResponse.json({ error: "Leaderboard intake is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const active = await prisma.familyMembership.findMany({ where: { active: true }, distinct: ["discordUserId"], select: { discordUserId: true } });
  const profiles = await prisma.voiceProfile.findMany({ where: { discordUserId: { in: active.map((membership) => membership.discordUserId) } }, select: { balance: true, discordUserId: true, totalVoiceSeconds: true } });
  const entries = profiles as Entry[];
  return NextResponse.json({ coins: [...entries].sort(byCoins).slice(0, LIMIT).map(serialize), generatedAt: new Date().toISOString(), voice: [...entries].sort(byVoice).slice(0, LIMIT).map(serialize) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
