import { discordOptions, refreshShop } from "@/lib/shop/bot";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getShopManager } from "@/lib/shop/access";
import { parseSettingsInput, ShopInputError } from "@/lib/shop/validation";
export const dynamic = "force-dynamic";
export async function PATCH(request: NextRequest) { const user = await getShopManager(); if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 }); try { const input = parseSettingsInput(await request.json()); if (input.discordChannelId && !(await discordOptions()).channels.some(channel => channel.id === input.discordChannelId)) throw new ShopInputError("Канал недоступен."); const settings = await prisma.familyShopSettings.upsert({ where: { family: input.family }, create: input, update: input }); await prisma.auditLog.create({ data: { actorId: user.id, action: "SHOP_SETTINGS_UPDATED", targetType: "FamilyShopSettings", targetId: settings.id, metadata: { family: settings.family } } }); return NextResponse.json({ settings, warning: await refreshShop(settings.family) }); } catch (error) { return NextResponse.json({ error: error instanceof ShopInputError ? error.message : "Не удалось сохранить настройки." }, { status: 400 }); } }
