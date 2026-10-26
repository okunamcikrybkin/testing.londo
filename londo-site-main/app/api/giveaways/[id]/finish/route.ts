import { NextResponse, type NextRequest } from "next/server";
import { getGiveawayManager } from "@/lib/giveaways/access";
import { finishGiveaway, publicGiveaway } from "@/lib/giveaways/data";
import { refreshGiveawayMessage } from "@/lib/giveaways/bot-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };

export async function POST(_: NextRequest, { params }: Context) {
  const user = await getGiveawayManager();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const result = await finishGiveaway((await params).id, { source: "MANUAL", actorUserId: user.id });
    if (!result.finished) return NextResponse.json({ error: "Розыгрыш уже завершён или недоступен для завершения." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    await refreshGiveawayMessage(result.giveaway.id, publicGiveaway(result.giveaway)).catch(() => undefined);
    return NextResponse.json({ giveaway: result.giveaway }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Не удалось завершить розыгрыш." }, { status: 409, headers: { "Cache-Control": "no-store" } }); }
}
