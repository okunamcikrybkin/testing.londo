import { prisma } from "@/lib/db/prisma";

type RecruiterStat = {
  id: string;
  discordId: string;
  displayName: string;
  username: string;
  total: number;
  applications: number;
  promotions: number;
  vacations: number;
  approved: number;
  rejected: number;
};

export async function getRecruiterStats(): Promise<RecruiterStat[]> {
  const [applications, promotions, vacations] = await Promise.all([
    prisma.familyApplication.groupBy({ by: ["reviewedByUserId", "status"], where: { reviewedByUserId: { not: null }, status: { in: ["ACCEPTED", "REJECTED"] } }, _count: { _all: true } }),
    prisma.promotionApplication.groupBy({ by: ["reviewedByDiscordId", "status"], where: { reviewedByDiscordId: { not: null }, status: { in: ["APPROVED", "REJECTED"] } }, _count: { _all: true } }),
    prisma.afkApplication.groupBy({ by: ["reviewedByDiscordId", "status"], where: { reviewedByDiscordId: { not: null }, status: { in: ["APPROVED", "REJECTED", "ENDED", "CANCELLED"] } }, _count: { _all: true } }),
  ]);

  const userIds = applications.map((item) => item.reviewedByUserId).filter((id): id is string => Boolean(id));
  const discordIds = [...promotions.map((item) => item.reviewedByDiscordId), ...vacations.map((item) => item.reviewedByDiscordId)].filter((id): id is string => Boolean(id));
  const users = await prisma.user.findMany({ where: { OR: [{ id: { in: userIds } }, { discordId: { in: discordIds } }] }, select: { id: true, discordId: true, displayName: true, username: true } });
  const byId = new Map(users.map((user) => [user.id, user]));
  const byDiscord = new Map(users.map((user) => [user.discordId, user]));
  const stats = new Map<string, RecruiterStat>();
  const get = (user: (typeof users)[number]) => {
    const current = stats.get(user.id);
    if (current) return current;
    const value = { id: user.id, discordId: user.discordId, displayName: user.displayName, username: user.username, total: 0, applications: 0, promotions: 0, vacations: 0, approved: 0, rejected: 0 };
    stats.set(user.id, value);
    return value;
  };
  for (const item of applications) { const user = item.reviewedByUserId ? byId.get(item.reviewedByUserId) : null; if (!user) continue; const stat = get(user); stat.total += item._count._all; stat.applications += item._count._all; if (item.status === "ACCEPTED") stat.approved += item._count._all; else stat.rejected += item._count._all; }
  for (const item of promotions) { const user = item.reviewedByDiscordId ? byDiscord.get(item.reviewedByDiscordId) : null; if (!user) continue; const stat = get(user); stat.total += item._count._all; stat.promotions += item._count._all; if (item.status === "APPROVED") stat.approved += item._count._all; else stat.rejected += item._count._all; }
  for (const item of vacations) { const user = item.reviewedByDiscordId ? byDiscord.get(item.reviewedByDiscordId) : null; if (!user) continue; const stat = get(user); stat.total += item._count._all; stat.vacations += item._count._all; if (item.status === "APPROVED" || item.status === "ENDED") stat.approved += item._count._all; else stat.rejected += item._count._all; }
  return [...stats.values()].sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName, "ru"));
}
