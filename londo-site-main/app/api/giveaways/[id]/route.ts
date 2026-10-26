import { NextResponse, type NextRequest } from "next/server";
import { getGiveawayManager } from "@/lib/giveaways/access";
import { canDeleteGiveaway, getGiveaway, giveawayInclude, publicGiveaway } from "@/lib/giveaways/data";
import { parseGiveawayInput } from "@/lib/giveaways/validation";
import { prisma } from "@/lib/db/prisma";
import { deleteGiveawayMessage } from "@/lib/giveaways/bot-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
export async function GET(_: NextRequest, { params }: Context) {
  if (!await getGiveawayManager()) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const giveaway = await getGiveaway((await params).id);
  return giveaway ? NextResponse.json({ giveaway }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
export async function PATCH(request: NextRequest, { params }: Context) {
  const user = await getGiveawayManager();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const id = (await params).id;
    const current = await prisma.giveaway.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (current.status === "ACTIVE" || current.status === "ENDED" || current.status === "CANCELLED") return NextResponse.json({ error: "Этот розыгрыш нельзя редактировать." }, { status: 409 });
    const input = parseGiveawayInput(await request.json(), { allowStatus: true });
    const giveaway = await prisma.giveaway.update({ where: { id }, data: input, include: giveawayInclude });
    return NextResponse.json({ giveaway }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось обновить розыгрыш." }, { status: 400 }); }
}

export async function DELETE(_: NextRequest, { params }: Context) {
  const user = await getGiveawayManager();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const id = (await params).id;
  const giveaway = await getGiveaway(id);
  if (!giveaway) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (giveaway.status === "ACTIVE") return NextResponse.json({ error: "Сначала отмените активный розыгрыш." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  if (!canDeleteGiveaway(giveaway.status)) return NextResponse.json({ error: "Этот розыгрыш нельзя удалить." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  await deleteGiveawayMessage(id, publicGiveaway(giveaway)).catch(() => undefined);
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({ data: { action: "GIVEAWAY_DELETED", actorId: user.id, targetId: id, targetType: "Giveaway" } });
    await tx.giveaway.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
