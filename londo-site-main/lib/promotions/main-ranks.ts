import { promotionRoleAllowlist } from "./role-allowlist";

/** Newbie is removable but is deliberately absent from the promotion picker. */
export const MAIN_RANK_ROLE_IDS = [...new Set([
  "1545123264626430071",
  ...promotionRoleAllowlist("MEMPHIS").map(r => r.roleId),
])];

export function mainRankCleanup(family: unknown, target: string, isPosition: boolean, positionRoleIds: readonly string[] = []): string[] {
  if (isPosition || !promotionRoleAllowlist(family).some(r => r.roleId === target)) return [];
  // Both Recruit IDs are main ranks; only the target is family-specific.
  return MAIN_RANK_ROLE_IDS.filter(id => id !== target && !positionRoleIds.includes(id));
}
