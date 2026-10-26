import {getRankColors} from "@/lib/rank-appearance/service";
import {getRankColor} from "@/lib/rank-appearance/rules";
import type { Family } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatBirthdayLabel } from "@/lib/profile/birthday";

export type RosterEntry = { rankRoleId?:string|null; rankColor?:string; afkUntil?: string | null; balance: string; birthday: string | null; discordDisplayName: string; discordUserId: string; profileId: string; gameNickname: string | null; rankDisplayName: string | null; rankPriority: number | null; staticId: string | null; totalVoiceSeconds: bigint; username: string };

/** Reads the current bot-synchronized roster, highest configured rank first. */
export async function getFamilyRoster(family: Family): Promise<RosterEntry[]> {
  const rows = await prisma.familyMembership.findMany({ where: { active: true, family }, include: { identity: { select: { displayName: true, gameNickname: true, staticId: true, username: true } } } });
  const discordIds = rows.map((row) => row.discordUserId);
  const [afk, profiles, siteUsers, colors] = await Promise.all([
    prisma.afkSession.findMany({ where: { family, status: "ACTIVE", endAt: { gt: new Date() } }, select: { discordUserId: true, endAt: true } }),
    prisma.voiceProfile.findMany({ where: { discordUserId: { in: discordIds } } }),
    prisma.user.findMany({ where: { discordId: { in: discordIds }, status: "ACTIVE" }, select: { id: true, discordId: true, birthdayMonth: true, birthdayDay: true, birthdayYear: true } }),
    getRankColors(),
  ]);
  const afkById = new Map(afk.map(s=>[s.discordUserId,s.endAt.toISOString()]));
  const profileById = new Map(profiles.map((profile) => [profile.discordUserId, profile]));
  const userByDiscordId = new Map(siteUsers.map((user) => [user.discordId, user]));
  return rows.map((row) => {
    const profile = profileById.get(row.discordUserId);
    const user = userByDiscordId.get(row.discordUserId);
    return { rankRoleId: row.rankRoleId, rankColor: getRankColor(row.rankRoleId, colors), afkUntil: afkById.get(row.discordUserId) ?? null, balance: profile?.balance.toString() ?? "0", birthday: formatBirthdayLabel(user?.birthdayMonth, user?.birthdayDay, user?.birthdayYear), discordDisplayName: row.identity.displayName, discordUserId: row.discordUserId, profileId: user?.id ?? row.discordUserId, gameNickname: row.identity.gameNickname, rankDisplayName: row.rankDisplayName, rankPriority: row.rankPriority, staticId: row.identity.staticId, totalVoiceSeconds: profile?.totalVoiceSeconds ?? BigInt(0), username: row.identity.username };
  }).sort((left, right) => (right.rankPriority ?? -1) - (left.rankPriority ?? -1) || (left.gameNickname ?? left.discordDisplayName).localeCompare(right.gameNickname ?? right.discordDisplayName, "ru"));
}

export async function getFamilyRosterStats(family: Family) {
  const now = new Date();
  const [members, onLeave] = await Promise.all([
    prisma.familyMembership.count({ where: { family, active: true } }),
    prisma.afkSession.count({ where: { family, status: "ACTIVE", endAt: { gt: now } } }),
  ]);
  return { members, onLeave };
}
