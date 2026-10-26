import { NextResponse, type NextRequest } from "next/server";
import { getGiveawayManager } from "@/lib/giveaways/access";
import { prisma } from "@/lib/db/prisma";
import { getGiveaway, publicGiveaway } from "@/lib/giveaways/data";
import { refreshGiveawayMessage } from "@/lib/giveaways/bot-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
export async function POST(_: NextRequest, { params }: Context) {
  const user = await getGiveawayManager();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const id = (await params).id;
  const result = await prisma.giveaway.updateMany({ where: { id, status: { in: ["DRAFT", "SCHEDULED", "ACTIVE"] } }, data: { status: "CANCELLED" } });
  if (result.count !== 1) return NextResponse.json({ error: "Отменить можно только активный или не запущенный розыгрыш." }, { status: 409 });
  await prisma.auditLog.create({ data: { action: "GIVEAWAY_CANCELLED", actorId: user.id, targetId: id, targetType: "Giveaway" } });
  const giveaway = await getGiveaway(id);
  if (giveaway) await refreshGiveawayMessage(id, publicGiveaway(giveaway)).catch(() => undefined);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
