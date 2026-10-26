import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { botAuthorized, noStore, unauthorized } from "@/lib/giveaways/internal";
import { isDiscordSnowflake } from "@/lib/giveaways/validation";
export const dynamic = "force-dynamic"; export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: Context) {
  if (!botAuthorized(request)) return unauthorized();
  try {
    const discordUserId = (await request.json()).discordUserId;
    if (!isDiscordSnowflake(discordUserId)) return noStore({ ok: false, code: "INVALID_REQUEST" }, 400);
    const id = (await params).id;
    const active = await prisma.giveaway.findFirst({ where: { id, status: "ACTIVE", endsAt: { gt: new Date() } } });
    if (!active) return noStore({ ok: false, code: "INACTIVE_GIVEAWAY" }, 409);
    try { await prisma.giveawayParticipant.create({ data: { giveawayId: id, discordUserId } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return noStore({ ok: false, code: "ALREADY_JOINED" }, 409); throw error; }
    const participantCount = await prisma.giveawayParticipant.count({ where: { giveawayId: id } });
    return noStore({ ok: true, participantCount });
  } catch { return noStore({ ok: false, code: "INVALID_REQUEST" }, 400); }
}
