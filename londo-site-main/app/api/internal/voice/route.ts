import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

const DISCORD_ID = /^\d{17,20}$/;
const MIN_SEGMENT_SECONDS = 15;

function authorized(request: NextRequest): boolean {
  const expected = process.env.LONDO_BOT_API_SECRET;
  const value = request.headers.get("x-londo-bot-secret");
  if (!expected || !value) return false;
  const a = Buffer.from(expected); const b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}
function id(value: unknown): string { if (typeof value !== "string" || !DISCORD_ID.test(value)) throw new Error("discordUserId is invalid."); return value; }
function coinAmount(minutes: number): string { const units = BigInt(minutes) * BigInt(333); const scale = BigInt(10_000); return `${units / scale}.${(units % scale).toString().padStart(4, "0")}`; }

async function startSession(discordUserId: string, now: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.voiceProfile.upsert({ where: { discordUserId }, create: { discordUserId }, update: {} });
    const existing = await tx.voiceActiveSession.findUnique({ where: { discordUserId } });
    if (!existing) await tx.voiceActiveSession.create({ data: { discordUserId, segmentStartedAt: now, lastCheckpointAt: now } });
    else if (!existing.active) await tx.voiceActiveSession.update({ where: { discordUserId }, data: { active: true, segmentStartedAt: now, lastCheckpointAt: now } });
  });
}

async function settleSession(discordUserId: string, keepActive: boolean, now: Date): Promise<{ paidMinutes: number }> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.voiceActiveSession.findUnique({ where: { discordUserId } });
    if (!session?.active) return { paidMinutes: 0 };
    const segmentSeconds = Math.floor((now.getTime() - session.segmentStartedAt.getTime()) / 1000);
    if (segmentSeconds < MIN_SEGMENT_SECONDS) {
      if (!keepActive) await tx.voiceActiveSession.update({ where: { discordUserId }, data: { active: false } });
      return { paidMinutes: 0 };
    }
    const delta = Math.floor((now.getTime() - session.lastCheckpointAt.getTime()) / 1000);
    if (delta <= 0) { if (!keepActive) await tx.voiceActiveSession.update({ where: { discordUserId }, data: { active: false } }); return { paidMinutes: 0 }; }
    const profile = await tx.voiceProfile.findUniqueOrThrow({ where: { discordUserId } });
    const combined = profile.voiceSecondsRemainder + delta;
    const paidMinutes = Math.floor(combined / 60);
    const remainder = combined % 60;
    const nextCheckpoint = new Date(session.lastCheckpointAt.getTime() + delta * 1000);
    await tx.voiceProfile.update({ where: { discordUserId }, data: { totalVoiceSeconds: { increment: BigInt(delta) }, voiceSecondsRemainder: remainder, xp: { increment: paidMinutes * 2 }, ...(paidMinutes ? { balance: { increment: coinAmount(paidMinutes) } } : {}) } });
    await tx.voiceActiveSession.update({ where: { discordUserId }, data: { active: keepActive, lastCheckpointAt: nextCheckpoint } });
    if (paidMinutes) await tx.economyTransaction.create({ data: { discordUserId, amount: coinAmount(paidMinutes), type: "CREDIT", reason: "VOICE", source: "VOICE_TRACKER", sourceId: `voice:${session.id}:${nextCheckpoint.toISOString()}` } });
    return { paidMinutes };
  });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body.");
    const { operation } = body as { operation?: string };
    const now = new Date();
    if (operation === "START") { await startSession(id((body as { discordUserId?: unknown }).discordUserId), now); return NextResponse.json({ ok: true }); }
    if (operation === "SETTLE") { const result = await settleSession(id((body as { discordUserId?: unknown }).discordUserId), Boolean((body as { keepActive?: unknown }).keepActive), now); return NextResponse.json({ ok: true, ...result }); }
    if (operation === "RECONCILE") {
      const ids = (body as { activeDiscordUserIds?: unknown }).activeDiscordUserIds;
      if (!Array.isArray(ids) || ids.some((value) => typeof value !== "string" || !DISCORD_ID.test(value))) throw new Error("activeDiscordUserIds is invalid.");
      await prisma.voiceActiveSession.updateMany({ where: { active: true }, data: { active: false } });
      for (const discordUserId of ids) await startSession(discordUserId, now);
      return NextResponse.json({ ok: true, activeSessions: ids.length });
    }
    throw new Error("Unsupported operation.");
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Voice operation failed." }, { status: 400 }); }
}
