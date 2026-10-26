import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { asRecord, botAuthorized, discordId, optionalText, requiredText } from "@/lib/twitch/internal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function optionalDate(value: unknown, field: string): Date | null {
  const text = optionalText(value, field, 100);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid.`);
  return date;
}

export async function POST(request: NextRequest) {
  if (!botAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = asRecord(await request.json());
    const discordUserId = discordId(body.discordUserId);
    if (typeof body.isLive !== "boolean") throw new Error("isLive is invalid.");
    const state = await prisma.twitchStreamState.upsert({
      where: { discordUserId },
      create: { discordUserId, twitchUserId: optionalText(body.twitchUserId, "twitchUserId", 100), currentStreamId: optionalText(body.currentStreamId, "currentStreamId", 100), announcedStreamId: optionalText(body.announcedStreamId, "announcedStreamId", 100), isLive: body.isLive, startedAt: optionalDate(body.startedAt, "startedAt"), lastSeenOnlineAt: optionalDate(body.lastSeenOnlineAt, "lastSeenOnlineAt"), lastSeenOfflineAt: optionalDate(body.lastSeenOfflineAt, "lastSeenOfflineAt"), lastCheckedAt: new Date(requiredText(body.lastCheckedAt, "lastCheckedAt", 100)) },
      update: { twitchUserId: optionalText(body.twitchUserId, "twitchUserId", 100), currentStreamId: optionalText(body.currentStreamId, "currentStreamId", 100), announcedStreamId: optionalText(body.announcedStreamId, "announcedStreamId", 100), isLive: body.isLive, startedAt: optionalDate(body.startedAt, "startedAt"), lastSeenOnlineAt: optionalDate(body.lastSeenOnlineAt, "lastSeenOnlineAt"), lastSeenOfflineAt: optionalDate(body.lastSeenOfflineAt, "lastSeenOfflineAt"), lastCheckedAt: new Date(requiredText(body.lastCheckedAt, "lastCheckedAt", 100)) },
    });
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Twitch state." }, { status: 400 });
  }
}
