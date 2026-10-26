import { discordOptions, refreshShop } from "@/lib/shop/bot";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getShopManager } from "@/lib/shop/access";
import { getShop } from "@/lib/shop/data";
import { parseItemInput, ShopInputError } from "@/lib/shop/validation";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) { const user = await getShopManager(); if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 }); try { const input = parseItemInput(await request.json()); if (input.isActive && input.type === "DISCORD_ROLE" && !(await discordOptions()).roles.some(role => role.id === input.discordRoleId)) throw new ShopInputError("Роль недоступна для выдачи."); await getShop(input.family); const item = await prisma.shopItem.create({ data: input }); await prisma.auditLog.create({ data: { actorId: user.id, action: "SHOP_ITEM_CREATED", targetType: "ShopItem", targetId: item.id, metadata: { family: item.family } } }); return NextResponse.json({ item, warning: await refreshShop(item.family) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof ShopInputError ? error.message : "Не удалось создать товар." }, { status: 400 }); } }
