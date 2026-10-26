import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { botAuthorized, noStore, unauthorized } from "@/lib/giveaways/internal";
import { isDiscordSnowflake } from "@/lib/giveaways/validation";
export const dynamic = "force-dynamic"; export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: Context) {
  if (!botAuthorized(request)) return unauthorized();
  const discordUserId = (await request.json().catch(() => ({}))).discordUserId;
  if (!isDiscordSnowflake(discordUserId)) return noStore({ ok: false, code: "INVALID_REQUEST" }, 400);
  await prisma.giveawayParticipant.deleteMany({ where: { giveawayId: (await params).id, discordUserId } });
  return noStore({ ok: true });
}
