import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { asRecord, botAuthorized, discordId, optionalText, requiredText, twitchLogin } from "@/lib/twitch/internal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  if (!botAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const profiles = await prisma.twitchProfile.findMany({ where: { enabled: true }, include: { state: true }, orderBy: { twitchLogin: "asc" } });
  return NextResponse.json({ profiles }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  if (!botAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = asRecord(await request.json());
    const discordUserId = discordId(body.discordUserId);
    const profile = await prisma.$transaction(async (tx) => {
      await tx.discordIdentity.upsert({ where: { discordUserId }, create: { discordUserId, username: requiredText(body.discordUsername, "discordUsername", 100), displayName: requiredText(body.discordDisplayName, "discordDisplayName", 100), avatarUrl: optionalText(body.avatarUrl, "avatarUrl", 2_000) }, update: { username: requiredText(body.discordUsername, "discordUsername", 100), displayName: requiredText(body.discordDisplayName, "discordDisplayName", 100), avatarUrl: optionalText(body.avatarUrl, "avatarUrl", 2_000) } });
      return tx.twitchProfile.upsert({ where: { discordUserId }, create: { discordUserId, twitchLogin: twitchLogin(body.twitchLogin), twitchUserId: optionalText(body.twitchUserId, "twitchUserId", 100), enabled: true }, update: { twitchLogin: twitchLogin(body.twitchLogin), twitchUserId: optionalText(body.twitchUserId, "twitchUserId", 100), enabled: true } });
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Twitch profile." }, { status: 400 });
  }
}
