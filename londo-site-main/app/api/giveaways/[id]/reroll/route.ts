import { NextResponse, type NextRequest } from "next/server";
import { getGiveawayManager } from "@/lib/giveaways/access";
import { publicGiveaway, rerollGiveaway } from "@/lib/giveaways/data";
import { refreshGiveawayMessage } from "@/lib/giveaways/bot-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: Context) {
  const user = await getGiveawayManager();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const body = await request.json();
    const position = body?.position;
    if (!Number.isInteger(position) || position < 1 || position > 20) throw new Error("Некорректная позиция победителя.");
    const giveaway = await rerollGiveaway((await params).id, position, user.id);
    await refreshGiveawayMessage(giveaway.id, publicGiveaway(giveaway)).catch(() => undefined);
    return NextResponse.json({ giveaway }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error && error.message === "NO_REROLL_CANDIDATE" ? "Нет участника для перевыбора." : "Не удалось перевыбрать победителя.";
    return NextResponse.json({ error: message }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
