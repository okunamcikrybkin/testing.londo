import type { NextRequest } from "next/server";
import { botAuthorized, noStore, unauthorized } from "@/lib/giveaways/internal";
import { prisma } from "@/lib/db/prisma";
import { listShops } from "@/lib/shop/data";
import { buyItem, settlePurchase } from "@/lib/shop/purchase";
import { parseFamily } from "@/lib/shop/validation";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (!botAuthorized(request)) return unauthorized();
  const pending = await prisma.shopPurchase.findMany({ where: { type: "DISCORD_ROLE", status: "PENDING_FULFILLMENT" } });
  const roles = await Promise.all(pending.map(async purchase => {
    const debit = await prisma.economyTransaction.findFirst({ where: { reason: "SHOP_PURCHASE", metadata: { path: ["purchaseId"], equals: purchase.id } } });
    return { ...purchase, discordRoleId: (debit?.metadata as { discordRoleId?: string } | null)?.discordRoleId ?? null };
  }));
  return noStore({ shops: await listShops(), pending: roles });
}
export async function POST(request: NextRequest) {
  if (!botAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    if (body.operation === "BUY") {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(body.itemId ?? "") || !/^\d{17,20}$/.test(body.discordUserId ?? "") || !/^\d{17,20}$/.test(body.interactionId ?? "")) return noStore({ code: "INVALID_INPUT" }, 400);
      return noStore({ purchase: await buyItem(body.itemId, body.discordUserId, body.interactionId) });
    }
    if (body.operation === "RESULT" && typeof body.id === "string") return noStore({ purchase: await prisma.shopPurchase.findUniqueOrThrow({ where: { id: body.id } }) });
    if (body.operation === "SETTLE" && typeof body.id === "string" && typeof body.refund === "boolean") return noStore(await settlePurchase(body.id, body.refund, null, true));
    if (body.operation === "PANEL") {
      const family = parseFamily(body.family);
      if (!/^\d{17,20}$/.test(body.messageId ?? "") || !/^\d{17,20}$/.test(body.channelId ?? "")) return noStore({ code: "INVALID_INPUT" },400);
      const updated = await prisma.familyShopSettings.updateMany({ where: { family, discordChannelId: body.channelId, discordMessageId: body.previousMessageId ?? null }, data: { discordMessageId: body.messageId } });
      return noStore({ ok: updated.count === 1 }, updated.count ? 200 : 409);
    }
    return noStore({ code: "INVALID_INPUT" },400);
  } catch (error) { const code = error instanceof Error ? error.message : "PURCHASE_FAILED"; const allowed = ["ITEM_UNAVAILABLE","SHOP_CLOSED","WRONG_FAMILY","ROLE_PENDING","ALREADY_OWNED","ROLE_UNAVAILABLE","INSUFFICIENT_BALANCE"]; return noStore({ code: allowed.includes(code) ? code : "PURCHASE_FAILED" },409); }
}
