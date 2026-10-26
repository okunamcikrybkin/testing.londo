import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { botAuthorized, noStore, unauthorized } from "@/lib/giveaways/internal";
import { isDiscordSnowflake } from "@/lib/giveaways/validation";
export const dynamic = "force-dynamic"; export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: Context) {
  if (!botAuthorized(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  if (!isDiscordSnowflake(body.discordMessageId)) return noStore({ ok: false, code: "INVALID_REQUEST" }, 400);
  const result = await prisma.giveaway.updateMany({ where: { id: (await params).id, status: { in: ["DRAFT", "SCHEDULED", "ACTIVE"] } }, data: { discordMessageId: body.discordMessageId } });
  return result.count === 1 ? noStore({ ok: true }) : noStore({ ok: false, code: "NOT_FOUND" }, 404);
}
