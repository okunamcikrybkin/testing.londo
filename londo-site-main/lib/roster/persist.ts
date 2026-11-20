import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type RankInput = { rankDisplayName: string; rankKey: string; rankPriority: number; rankRoleId: string } | null;
type RosterMemberInput = { avatarUrl: string | null; discordDisplayName: string; discordUserId: string; discordUsername: string; gameNickname: string; rank: RankInput; staticId: string | null };
export type RosterSnapshotInput = { family: "MEMPHIS"; members: RosterMemberInput[]; serverId: string };

const ROSTER_TRANSACTION_TIMEOUT_MS = 30_000;
const ROSTER_TRANSACTION_MAX_WAIT_MS = 10_000;

export async function persistRosterSnapshot(
  snapshot: RosterSnapshotInput,
  database: Pick<PrismaClient, "$transaction"> = prisma,
): Promise<number> {
  const syncedAt = new Date();
  return database.$transaction(async (transaction) => {
    const existing = await transaction.familyMembership.findMany({
      where: { family: snapshot.family },
      select: { active: true, discordUserId: true, rankKey: true },
    });
    const previousByDiscordId = new Map(existing.map((membership) => [membership.discordUserId, membership]));
    const identityRows = snapshot.members.map((member) => Prisma.sql`(
      ${member.discordUserId}, ${member.discordUsername}, ${member.discordDisplayName},
      ${member.avatarUrl}, ${member.gameNickname}, ${member.staticId}, ${syncedAt}
    )`);
    const membershipRows = snapshot.members.map((member) => Prisma.sql`(
      ${randomUUID()}, ${member.discordUserId}, ${snapshot.family}::"Family", TRUE,
      ${member.rank?.rankKey ?? null}, ${member.rank?.rankDisplayName ?? null},
      ${member.rank?.rankRoleId ?? null}, ${member.rank?.rankPriority ?? null},
      ${syncedAt}, ${syncedAt}
    )`);

    if (identityRows.length > 0) {
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "discord_identities" (
          "discord_user_id", "username", "display_name", "avatar_url",
          "game_nickname", "static_id", "updated_at"
        ) VALUES ${Prisma.join(identityRows)}
        ON CONFLICT ("discord_user_id") DO UPDATE SET
          "username" = EXCLUDED."username",
          "display_name" = EXCLUDED."display_name",
          "avatar_url" = EXCLUDED."avatar_url",
          "game_nickname" = EXCLUDED."game_nickname",
          "static_id" = EXCLUDED."static_id",
          "updated_at" = EXCLUDED."updated_at"
      `);
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "family_memberships" (
          "id", "discord_user_id", "family", "active", "rank_key",
          "rank_display_name", "rank_role_id", "rank_priority",
          "last_synced_at", "updated_at"
        ) VALUES ${Prisma.join(membershipRows)}
        ON CONFLICT ("discord_user_id", "family") DO UPDATE SET
          "active" = TRUE,
          "rank_key" = EXCLUDED."rank_key",
          "rank_display_name" = EXCLUDED."rank_display_name",
          "rank_role_id" = EXCLUDED."rank_role_id",
          "rank_priority" = EXCLUDED."rank_priority",
          "last_synced_at" = EXCLUDED."last_synced_at",
          "updated_at" = EXCLUDED."updated_at"
      `);
    }

    const rankChangeEvents: Prisma.LogEventCreateManyInput[] = [];
    for (const member of snapshot.members) {
      const previous = previousByDiscordId.get(member.discordUserId);
      if (!previous?.active || previous.rankKey === (member.rank?.rankKey ?? null)) continue;

      const newRankKey = member.rank?.rankKey ?? null;
      rankChangeEvents.push({
        id: randomUUID(),
        source: "LONDO_BOT",
        sourceEventId: `roster-rank:${snapshot.family}:${member.discordUserId}:${previous.rankKey ?? "none"}:${newRankKey ?? "none"}:${syncedAt.getTime()}`,
        type: "ROSTER_RANK_CHANGED",
        category: "RANK",
        action: "ROSTER_RANK_CHANGED",
        result: "SUCCESS",
        family: snapshot.family,
        serverId: snapshot.serverId,
        targetDiscordId: member.discordUserId,
        targetUsername: member.discordUsername,
        targetDisplayName: member.discordDisplayName,
        summary: `Roster rank changed: ${previous.rankKey ?? "Без ранга"} → ${newRankKey ?? "Без ранга"}.`,
        metadata: {
          discordUserId: member.discordUserId,
          family: snapshot.family,
          oldRank: previous.rankKey,
          newRank: newRankKey,
        },
      });
    }
    if (rankChangeEvents.length > 0) {
      await transaction.logEvent.createMany({ data: rankChangeEvents });
    }

    await transaction.familyMembership.updateMany({
      where: {
        family: snapshot.family,
        active: true,
        ...(snapshot.members.length > 0
          ? { discordUserId: { notIn: snapshot.members.map((member) => member.discordUserId) } }
          : {}),
      },
      data: { active: false, lastSyncedAt: syncedAt },
    });
    return rankChangeEvents.length;
  }, { maxWait: ROSTER_TRANSACTION_MAX_WAIT_MS, timeout: ROSTER_TRANSACTION_TIMEOUT_MS });
}
