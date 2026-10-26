import { prisma } from "@/lib/db/prisma";
import { botAuthorized, noStore, unauthorized } from "@/lib/giveaways/internal";
import { publicGiveaway } from "@/lib/giveaways/data";
import type { NextRequest } from "next/server";
export const dynamic = "force-dynamic"; export const revalidate = 0;
export async function GET(request: NextRequest) {
  if (!botAuthorized(request)) return unauthorized();
  const giveaways = await prisma.giveaway.findMany({ where: { status: "ACTIVE" }, include: { createdBy: { select: { discordId: true, displayName: true, username: true } }, participants: true, winners: true, drawEvents: true }, orderBy: { endsAt: "asc" } });
  return noStore({ giveaways: giveaways.map(publicGiveaway) });
}
