import { FAMILY_RANKS } from "../config/familyRanks.js";
import { promotionRoleAllowlist } from "./role-allowlist.js";

/** Newbie is removable but is deliberately absent from the promotion picker. */
export const MAIN_RANK_ROLE_IDS = [...new Set([
  ...FAMILY_RANKS.filter(rank => rank.key === "NEWBIE").map(rank => rank.roleId),
  ...promotionRoleAllowlist("MEMPHIS").map(r => r.roleId),
])];

export function mainRankCleanup(family: unknown, target: string, isPosition: boolean, positionRoleIds: readonly string[] = []): string[] {
  if (isPosition || !promotionRoleAllowlist(family).some(r => r.roleId === target)) return [];
  // The target role is the only retained main rank.
  return MAIN_RANK_ROLE_IDS.filter(id => id !== target && !positionRoleIds.includes(id));
}
