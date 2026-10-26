import { prisma } from "../db/prisma";
import { cooldownEnd, historyScope, type Actor } from "./rules";
export function serialize<T>(value: T) { return JSON.parse(JSON.stringify(value)); }
export async function playerState(user: Actor) {
  const scope = historyScope(user);
  const [settings, prizes, profile, history, lastFree] = await Promise.all([
    prisma.rouletteSettings.findUniqueOrThrow({ where: { id: "global" } }),
    prisma.roulettePrize.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, type: true, description: true } }),
    prisma.voiceProfile.findUnique({ where: { discordUserId: user.discordId } }),
    prisma.rouletteSpin.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.rouletteSpin.findFirst({ where: { ...scope, spinType: "FREE" }, orderBy: { createdAt: "desc" } }),
  ]);
  return serialize({ settings, prizes, balance: profile?.balance.toString() || "0", history, nextFreeAt: cooldownEnd(lastFree?.createdAt ?? null, settings.freeSpinCooldownHours), serverNow: new Date() });
}
