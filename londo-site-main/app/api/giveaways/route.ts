import { NextResponse, type NextRequest } from "next/server";
import { getGiveawayManager } from "@/lib/giveaways/access";
import { giveawayInclude, listGiveaways } from "@/lib/giveaways/data";
import { parseGiveawayInput } from "@/lib/giveaways/validation";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  if (!await getGiveawayManager()) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ giveaways: await listGiveaways() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = await getGiveawayManager();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const input = parseGiveawayInput(await request.json(), { allowStatus: true });
    const giveaway = await prisma.giveaway.create({ data: { ...input, createdByUserId: user.id }, include: giveawayInclude });
    await prisma.auditLog.create({ data: { action: "GIVEAWAY_CREATED", actorId: user.id, targetId: giveaway.id, targetType: "Giveaway", metadata: { family: giveaway.family } } });
    return NextResponse.json({ giveaway }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось создать розыгрыш." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
