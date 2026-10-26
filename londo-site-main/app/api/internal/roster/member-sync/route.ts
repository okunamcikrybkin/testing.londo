import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { Family } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const DISCORD_ID = /^\d{17,20}$/;
const FAMILIES = ["MEMPHIS"] as const;
type Membership = { active: boolean; family: Family; rank: { key: string; label: string; priority: number; roleId: string } | null };

function authorized(request: NextRequest): boolean {
  const expected = process.env.LONDO_BOT_API_SECRET;
  const value = request.headers.get("x-londo-bot-secret");
  if (!expected || !value) return false;
  const expectedBuffer = Buffer.from(expected); const valueBuffer = Buffer.from(value);
  return expectedBuffer.length === valueBuffer.length && timingSafeEqual(expectedBuffer, valueBuffer);
}
function requiredText(value: unknown, field: string, max = 100): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${field} is invalid.`);
  return value.trim();
}
function discordId(value: unknown, field: string): string {
  const result = requiredText(value, field, 20);
  if (!DISCORD_ID.test(result)) throw new Error(`${field} is invalid.`);
  return result;
}
function optionalText(value: unknown, field: string, max = 2_000): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredText(value, field, max);
}
function parseMembership(value: unknown): Membership {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("membership is invalid.");
  const membership = value as Record<string, unknown>;
  const family = requiredText(membership.family, "family", 20);
  if (!FAMILIES.includes(family as Family) || typeof membership.active !== "boolean") throw new Error("membership is invalid.");
  if (membership.rank === null || membership.rank === undefined) return { active: membership.active, family: family as Family, rank: null };
  if (!membership.rank || typeof membership.rank !== "object" || Array.isArray(membership.rank)) throw new Error("rank is invalid.");
  const rank = membership.rank as Record<string, unknown>;
  if (!Number.isInteger(rank.priority) || (rank.priority as number) < 1 || (rank.priority as number) > 12) throw new Error("rank is invalid.");
  return { active: membership.active, family: family as Family, rank: { key: requiredText(rank.key, "rank.key"), label: requiredText(rank.label, "rank.label"), priority: rank.priority as number, roleId: discordId(rank.roleId, "rank.roleId") } };
}

export async function POST(request: NextRequest) {
  if (!process.env.LONDO_BOT_API_SECRET) return NextResponse.json({ error: "Roster intake is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Payload is invalid.");
    const input = body as Record<string, unknown>;
    const discordUserId = discordId(input.discordUserId, "discordUserId");
    const memberships = Array.isArray(input.memberships) ? input.memberships.map(parseMembership) : [];
    if (memberships.length !== FAMILIES.length || new Set(memberships.map((membership) => membership.family)).size !== FAMILIES.length) throw new Error("memberships are invalid.");
    const syncedAt = new Date();
    await prisma.$transaction(async (tx) => {
      const identity = { username: requiredText(input.discordUsername, "discordUsername"), displayName: requiredText(input.discordDisplayName, "discordDisplayName"), avatarUrl: optionalText(input.avatarUrl, "avatarUrl"), gameNickname: requiredText(input.gameNickname, "gameNickname"), staticId: optionalText(input.staticId, "staticId", 100) };
      await tx.discordIdentity.upsert({ where: { discordUserId }, create: { discordUserId, ...identity }, update: identity });
      for (const membership of memberships) {
        await tx.familyMembership.upsert({ where: { discordUserId_family: { discordUserId, family: membership.family } }, create: { discordUserId, family: membership.family, active: membership.active, rankKey: membership.rank?.key, rankDisplayName: membership.rank?.label, rankPriority: membership.rank?.priority, rankRoleId: membership.rank?.roleId, lastSyncedAt: syncedAt }, update: { active: membership.active, rankKey: membership.rank?.key ?? null, rankDisplayName: membership.rank?.label ?? null, rankPriority: membership.rank?.priority ?? null, rankRoleId: membership.rank?.roleId ?? null, lastSyncedAt: syncedAt } });
      }
    });
    return NextResponse.json({ accepted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process member sync." }, { status: 400 });
  }
}
