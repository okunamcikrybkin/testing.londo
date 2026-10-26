import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { botAuthorized, discordId } from "@/lib/twitch/internal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(request: NextRequest, context: { params: Promise<{ discordUserId: string }> }) {
  if (!botAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { discordUserId: rawDiscordUserId } = await context.params;
    await prisma.twitchProfile.delete({ where: { discordUserId: discordId(rawDiscordUserId) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Twitch profile not found." }, { status: 404 });
  }
}
