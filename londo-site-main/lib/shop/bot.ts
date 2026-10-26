import { prisma } from "@/lib/db/prisma";
import type { Family } from "@prisma/client";
export type DiscordOptions = { channels: { id: string; name: string }[]; roles: { id: string; name: string; position: number }[] };
export async function shopBot<T>(path: string, body?: object): Promise<T> {
  const base = process.env.LONDO_BOT_INTERNAL_URL;
  const secret = process.env.LONDO_BOT_API_SECRET;
  if (!base || !secret) throw new Error("Discord Bot не настроен.");
  const response = await fetch(new URL(path, base), { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-londo-bot-secret": secret }, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Discord Bot недоступен или отклонил запрос.");
  return response.json() as Promise<T>;
}
export function discordOptions() { return shopBot<DiscordOptions>("/internal/discord/shop/options"); }
export async function refreshShop(family: Family) {
  try { await shopBot("/internal/discord/shop/refresh", { family }); await prisma.auditLog.create({ data: { action: "SHOP_PANEL_REFRESHED", targetType: "FamilyShopSettings", targetId: family } }); return null; }
  catch { return "Изменения сохранены. Discord-магазин не обновлён; повторите обновление после запуска bot."; }
}
