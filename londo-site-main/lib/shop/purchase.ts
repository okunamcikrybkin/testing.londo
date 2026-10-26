import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { shopBot } from "./bot";

// The profile row serializes every purchase for an identity, including dual-family buyers.
export async function buyItem(itemId: string, discordUserId: string, interactionId: string, dependencies = { db: prisma, roleCheck: (body: object) => shopBot<{ code: string }>("/internal/discord/shop/role-check", body) }) {
  return dependencies.db.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT discord_user_id FROM voice_profiles WHERE discord_user_id = ${discordUserId} FOR UPDATE`);
    const previous = await tx.economyTransaction.findUnique({ where: { sourceId: "shop-buy:" + interactionId } });
    if (previous) {
      const metadata = previous.metadata as { purchaseId: string };
      return tx.shopPurchase.findUniqueOrThrow({ where: { id: metadata.purchaseId } });
    }
    // Lock catalog state so closing/editing a shop cannot race the debit.
    const item = await tx.shopItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("ITEM_UNAVAILABLE");
    await tx.$queryRaw(Prisma.sql`SELECT id FROM family_shop_settings WHERE family = ${item.family}::"Family" FOR SHARE`);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM shop_items WHERE id = ${itemId} FOR SHARE`);
    const current = await tx.shopItem.findUniqueOrThrow({ where: { id: itemId }, include: { settings: true } });
    if (!current.isActive || current.deletedAt || current.family !== item.family) throw new Error("ITEM_UNAVAILABLE");
    if (current.settings.status !== "OPEN") throw new Error("SHOP_CLOSED");
    await tx.$queryRaw(Prisma.sql`SELECT id FROM family_memberships WHERE discord_user_id = ${discordUserId} AND family = ${current.family}::"Family" FOR SHARE`);
    const membership = await tx.familyMembership.findUnique({ where: { discordUserId_family: { discordUserId, family: current.family } } });
    if (!membership?.active) throw new Error("WRONG_FAMILY");
    if (current.type === "DISCORD_ROLE") {
      const pending = await tx.shopPurchase.findFirst({ where: { discordUserId, type: "DISCORD_ROLE", status: "PENDING_FULFILLMENT" } });
      if (pending) throw new Error("ROLE_PENDING");
      const checked = await dependencies.roleCheck({ discordUserId, roleId: current.discordRoleId });
      if (checked.code !== "OK") throw new Error(checked.code);
    }
    const debited = await tx.voiceProfile.updateMany({ where: { discordUserId, balance: { gte: current.price } }, data: { balance: { decrement: current.price } } });
    if (debited.count !== 1) throw new Error("INSUFFICIENT_BALANCE");
    const id = randomUUID();
    const metadata = { shopItemId: current.id, purchaseId: id, family: current.family, itemName: current.name, discordRoleId: current.discordRoleId };
    const purchase = await tx.shopPurchase.create({ data: { id, itemId, discordUserId, family: current.family, price: current.price, type: current.type } });
    await tx.economyTransaction.create({ data: { discordUserId, amount: current.price, type: "DEBIT", reason: "SHOP_PURCHASE", source: "SHOP", sourceId: "shop-buy:" + interactionId, metadata } });
    await tx.auditLog.create({ data: { action: "SHOP_PURCHASE_CREATED", targetType: "ShopPurchase", targetId: id, metadata } });
    return purchase;
  }, { timeout: 25000 });
}

export async function settlePurchase(id: string, refund: boolean, actorId: string | null = null, role = false, db = prisma) {
  return db.$transaction(async tx => {
    const existing = await tx.shopPurchase.findUniqueOrThrow({ where: { id } });
    await tx.$queryRaw(Prisma.sql`SELECT discord_user_id FROM voice_profiles WHERE discord_user_id = ${existing.discordUserId} FOR UPDATE`);
    // Claim the state before touching balance: a second refund sees zero matching rows.
    const claimed = await tx.shopPurchase.updateMany({ where: { id, status: "PENDING_FULFILLMENT", type: role ? "DISCORD_ROLE" : "MANUAL" }, data: { status: refund ? "REFUNDED" : "COMPLETED", ...(refund ? { refundedAt: new Date() } : { completedAt: new Date() }), fulfilledById: actorId } });
    const purchase = await tx.shopPurchase.findUniqueOrThrow({ where: { id } });
    if (!claimed.count) return { changed: false, purchase };
    if (refund) {
      await tx.voiceProfile.update({ where: { discordUserId: purchase.discordUserId }, data: { balance: { increment: purchase.price } } });
      const debit = await tx.economyTransaction.findFirst({ where: { reason: "SHOP_PURCHASE", metadata: { path: ["purchaseId"], equals: id } } });
      await tx.economyTransaction.create({ data: { discordUserId: purchase.discordUserId, amount: purchase.price, type: "CREDIT", reason: "SHOP_REFUND", source: "SHOP", sourceId: "shop-refund:" + id, metadata: debit?.metadata ?? { purchaseId: id, shopItemId: purchase.itemId, family: purchase.family } } });
    }
    await tx.auditLog.create({ data: { actorId, action: refund ? "SHOP_PURCHASE_REFUNDED" : "SHOP_PURCHASE_COMPLETED", targetType: "ShopPurchase", targetId: id } });
    if (role && !refund) await tx.auditLog.create({ data: { action: "SHOP_ROLE_GRANTED", targetType: "ShopPurchase", targetId: id } });
    return { changed: true, purchase };
  });
}
