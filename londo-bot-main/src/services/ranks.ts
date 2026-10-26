import { resolvePromotionRank } from "./promotionRanks.js";
import type { GuildMember } from "discord.js";
import { FAMILY_RANKS, type FamilyRankDefinition } from "../config/familyRanks.js";
import type { Family } from "../types/family.js";

export type ResolvedFamilyRank = Pick<FamilyRankDefinition, "key" | "label" | "priority" | "roleId">;

/** Resolves a member's highest configured rank in one family scope. */
export function resolveFamilyRank(member: GuildMember, family: Family): ResolvedFamilyRank | null {
  const matching = FAMILY_RANKS.filter((rank) => rank.scopes.includes(family) && member.roles.cache.has(rank.roleId));
  const rank = matching.sort((left, right) => right.priority - left.priority)[0];

  if (!rank || rank.priority < 7) { const promotion = resolvePromotionRank(id => member.roles.cache.has(id), family); if (promotion) return promotion; }
  return rank ? { key: rank.key, label: rank.label, priority: rank.priority, roleId: rank.roleId } : null;
}
