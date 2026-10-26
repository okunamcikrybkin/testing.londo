import { prisma } from "../db/prisma";
import { discordOptions } from "../shop/bot";
import { prizeInput, requireAdmin, RouletteError, settingsInput, type Actor } from "./rules";
export async function saveSettings(user: Actor | null, body: unknown, db = prisma) {
  requireAdmin(user); const data = settingsInput(body);
  return db.$transaction(async tx => {
    const settings = await tx.rouletteSettings.update({ where: { id: "global" }, data });
    await tx.auditLog.create({ data: { actorId: user.id, action: "ROULETTE_SETTINGS_UPDATED", targetType: "RouletteSettings", targetId: "global", metadata: data } });
    return settings;
  });
}
export async function savePrize(user: Actor | null, id: string | null, body: unknown, db = prisma, options = discordOptions) {
  requireAdmin(user); const data = prizeInput(body);
  if (data.isActive && data.type === "DISCORD_ROLE" && !(await options()).roles.some(r => r.id === data.discordRoleId)) throw new RouletteError("ROLE_UNAVAILABLE", "Роль недоступна для выдачи.");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM roulette_settings WHERE id = 'global' FOR UPDATE`;
    if (data.isActive && await tx.roulettePrize.count({ where: { isActive: true, deletedAt: null, ...(id ? { id: { not: id } } : {}) } }) >= 24) throw new RouletteError("PRIZE_LIMIT", "На колесе может быть не больше 24 активных призов.");
    if (id && !(await tx.roulettePrize.findFirst({ where: { id, deletedAt: null } }))) throw new RouletteError("NOT_FOUND", "Приз не найден.", 404);
    const prize = id ? await tx.roulettePrize.update({ where: { id }, data }) : await tx.roulettePrize.create({ data });
    await tx.auditLog.create({ data: { actorId: user.id, action: id ? "ROULETTE_PRIZE_UPDATED" : "ROULETTE_PRIZE_CREATED", targetType: "RoulettePrize", targetId: prize.id } });
    return prize;
  });
}
export async function deletePrize(user: Actor | null, id: string, db = prisma) {
  requireAdmin(user);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM roulette_settings WHERE id = 'global' FOR UPDATE`;
    const prize = await tx.roulettePrize.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "ROULETTE_PRIZE_DELETED", targetType: "RoulettePrize", targetId: id } });
    return prize;
  });
}
