import { NextResponse, type NextRequest } from "next/server";
import { getGiveawayManager } from "@/lib/giveaways/access";
import { getGiveaway, publicGiveaway } from "@/lib/giveaways/data";
import { publishGiveaway, GiveawayBotError } from "@/lib/giveaways/bot-client";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
export async function POST(_: NextRequest, { params }: Context) {
  const user = await getGiveawayManager();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const id = (await params).id;
  const giveaway = await getGiveaway(id);
  if (!giveaway) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!["DRAFT", "SCHEDULED"].includes(giveaway.status) || giveaway.endsAt <= new Date()) return NextResponse.json({ error: "Розыгрыш нельзя запустить в текущем состоянии." }, { status: 409 });
  try {
    const { messageId } = await publishGiveaway(id, { ...publicGiveaway(giveaway), status: "ACTIVE" });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.giveaway.updateMany({ where: { id, status: { in: ["DRAFT", "SCHEDULED"] } }, data: { discordMessageId: messageId, startedAt: new Date(), status: "ACTIVE" } });
      if (result.count !== 1) throw new Error("STATE_CHANGED");
      await tx.auditLog.create({ data: { action: "GIVEAWAY_STARTED", actorId: user.id, targetId: id, targetType: "Giveaway" } });
      return tx.giveaway.findUniqueOrThrow({ where: { id } });
    });
    return NextResponse.json({ giveaway: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof GiveawayBotError ? error.message : "Не удалось запустить розыгрыш." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
