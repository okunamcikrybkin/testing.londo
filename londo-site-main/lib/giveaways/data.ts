import { randomInt } from "node:crypto";
import { Prisma, type Giveaway, type GiveawayFamily } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const giveawayInclude = {
  createdBy: { select: { discordId: true, displayName: true, username: true } },
  participants: { orderBy: { joinedAt: "asc" as const } },
  winners: { orderBy: [{ position: "asc" as const }, { selectedAt: "asc" as const }] },
  drawEvents: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.GiveawayInclude;

export type GiveawayWithRelations = Prisma.GiveawayGetPayload<{ include: typeof giveawayInclude }>;

export async function getGiveaway(id: string): Promise<GiveawayWithRelations | null> {
  return prisma.giveaway.findFirst({ where: { id, family: { in: ["MEMPHIS", "ALL"] } }, include: giveawayInclude });
}

export async function listGiveaways(): Promise<GiveawayWithRelations[]> {
  return prisma.giveaway.findMany({ where: { family: { in: ["MEMPHIS", "ALL"] } }, include: giveawayInclude, orderBy: { createdAt: "desc" } });
}

export function canDeleteGiveaway(status: Giveaway["status"]): boolean {
  return status === "DRAFT" || status === "CANCELLED" || status === "ENDED";
}

export function canFinishGiveaway(status: Giveaway["status"]): boolean {
  return status === "ACTIVE";
}

export function publicGiveaway(giveaway: GiveawayWithRelations) {
  return {
    description: giveaway.description,
    createdAt: giveaway.createdAt.toISOString(),
    organizerDiscordId: giveaway.createdBy.discordId,
    discordChannelId: giveaway.discordChannelId,
    discordMessageId: giveaway.discordMessageId,
    endsAt: giveaway.endsAt.toISOString(),
    endedAt: giveaway.endedAt?.toISOString() ?? null,
    family: giveaway.family,
    id: giveaway.id,
    imageUrl: giveaway.imageUrl,
    mentionRoleId: giveaway.mentionRoleId,
    participantCount: giveaway.participants.length,
    participants: giveaway.participants.map((participant) => ({ discordUserId: participant.discordUserId, joinedAt: participant.joinedAt.toISOString() })),
    prize: giveaway.prize,
    requiredRoleId: giveaway.requiredRoleId,
    status: giveaway.status,
    winnerCount: giveaway.winnerCount,
    winners: giveaway.winners.map((winner) => ({ discordUserId: winner.discordUserId, isRerolled: winner.isRerolled, position: winner.position, selectedAt: winner.selectedAt.toISOString() })),
  };
}

function selectWinners(ids: string[], count: number): string[] {
  const pool = [...ids];
  const selected: string[] = [];
  while (pool.length > 0 && selected.length < count) {
    selected.push(pool.splice(randomInt(pool.length), 1)[0]);
  }
  return selected;
}

type FinishSource = { source: "AUTO" } | { source: "MANUAL"; actorUserId: string };

/** Atomically moves one active giveaway to ENDED and uses one draw implementation for auto and manual completion. */
export async function finishGiveaway(id: string, source: FinishSource = { source: "AUTO" }): Promise<{ giveaway: GiveawayWithRelations; finished: boolean }> {
  return prisma.$transaction(async (tx) => {
    const transitioned = await tx.giveaway.updateMany({
      where: { id, status: "ACTIVE", ...(source.source === "AUTO" ? { endsAt: { lte: new Date() } } : {}) },
      data: { endedAt: new Date(), status: "ENDED" },
    });
    const current = await tx.giveaway.findUnique({ where: { id }, include: giveawayInclude });
    if (!current) throw new Error("NOT_FOUND");
    if (transitioned.count !== 1) return { giveaway: current, finished: false };
    const winners = selectWinners(current.participants.map((entry) => entry.discordUserId), current.winnerCount);
    await Promise.all(winners.map((discordUserId, index) => tx.giveawayWinner.create({ data: { giveawayId: id, discordUserId, position: index + 1 } })));
    await tx.giveawayDrawEvent.create({ data: { action: "FINISHED", giveawayId: id } });
    await tx.auditLog.create({ data: { action: source.source === "MANUAL" ? "GIVEAWAY_FINISHED_MANUALLY" : "GIVEAWAY_ENDED", ...(source.source === "MANUAL" ? { actorId: source.actorUserId } : {}), targetId: id, targetType: "Giveaway", metadata: { giveawayId: id, participantCount: current.participants.length, source: source.source, winnerCount: winners.length } } });
    const giveaway = await tx.giveaway.findUniqueOrThrow({ where: { id }, include: giveawayInclude });
    return { giveaway, finished: true };
  });
}

export async function rerollGiveaway(id: string, position: number, actorUserId: string): Promise<GiveawayWithRelations> {
  return prisma.$transaction(async (tx) => {
    const giveaway = await tx.giveaway.findUnique({ where: { id }, include: giveawayInclude });
    if (!giveaway) throw new Error("NOT_FOUND");
    if (giveaway.status !== "ENDED") throw new Error("INVALID_STATE");
    const previous = giveaway.winners.find((winner) => winner.position === position && !winner.isRerolled);
    if (!previous) throw new Error("WINNER_NOT_FOUND");
    const allWon = new Set(giveaway.winners.map((winner) => winner.discordUserId));
    const candidate = selectWinners(giveaway.participants.map((entry) => entry.discordUserId).filter((discordUserId) => !allWon.has(discordUserId)), 1)[0];
    if (!candidate) throw new Error("NO_REROLL_CANDIDATE");
    await tx.giveawayWinner.update({ where: { id: previous.id }, data: { isRerolled: true, rerolledAt: new Date() } });
    await tx.giveawayWinner.create({ data: { giveawayId: id, discordUserId: candidate, position } });
    await tx.giveawayDrawEvent.create({ data: { action: "REROLLED", actorUserId, giveawayId: id, position, previousWinnerId: previous.discordUserId, winnerId: candidate } });
    await tx.auditLog.create({ data: { action: "GIVEAWAY_REROLLED", actorId: actorUserId, targetId: id, targetType: "Giveaway", metadata: { position } } });
    return tx.giveaway.findUniqueOrThrow({ where: { id }, include: giveawayInclude });
  });
}

export function isFamilyEligible(family: GiveawayFamily, roles: { fam: string; memphis: string; phoenix: string }, roleIds: Set<string>): boolean {
  if (!roleIds.has(roles.fam)) return false;
  if (family === "MEMPHIS") return roleIds.has(roles.memphis);
  if (family === "PHOENIX") return false;
  return true;
}
