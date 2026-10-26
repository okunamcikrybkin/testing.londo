import { Prisma, type Family, type ShopPurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const shopInclude = { items: { include: { _count: { select: { purchases: true } } }, where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] } } satisfies Prisma.FamilyShopSettingsInclude;
export async function getShop(family: Family) { return prisma.familyShopSettings.upsert({ where: { family }, create: { family }, update: {}, include: shopInclude }); }
export async function listShops() { return [await getShop("MEMPHIS")]; }
export async function listPurchases(filters: { family?: Family; status?: ShopPurchaseStatus } = {}) { return prisma.shopPurchase.findMany({ where: { family: "MEMPHIS", ...(filters.status ? { status: filters.status } : {}) }, include: { item: true, fulfilledBy: { select: { displayName: true, discordId: true } } }, orderBy: { createdAt: "desc" } }); }
export { } ;
import { settlePurchase } from "./purchase";
export async function completePurchase(id: string, actorId: string) { return settlePurchase(id, false, actorId); }
export async function refundPurchase(id: string, actorId: string) { return settlePurchase(id, true, actorId); }
