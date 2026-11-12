import { FAMILY_RANKS } from "../config/familyRanks.js";

const rankIds = new Map(FAMILY_RANKS.map(rank => [rank.key, rank.roleId]));
const shared = [
  ["BABY_LONDO", 2],
  ["YOUNG_LONDO", 3],
  ["LONDO", 4],
  ["LONDEST_LONDO", 6],
  ["MAIN", 8],
] as const;

function rankId(key: typeof shared[number][0]): string {
  const roleId = rankIds.get(key);
  if (!roleId) throw new Error(`Missing configured rank role: ${key}.`);
  return roleId;
}

export function promotionRoleAllowlist(family: unknown): readonly { roleId: string; order: number }[] {
  if (family !== "MEMPHIS") return [];
  const recruitId = rankIds.get("MEMPHIS_RECRUIT");
  if (!recruitId || !/^\d{17,20}$/.test(recruitId)) throw new Error("Missing or invalid configured Recruit role for MEMPHIS.");
  return [
    ...shared.slice(0, 3).map(([key, order]) => ({ roleId: rankId(key), order })),
    { roleId: recruitId, order: 5 },
    ...shared.slice(3).map(([key, order]) => ({ roleId: rankId(key), order })),
  ];
}

export function isPromotionRoleAllowed(family: unknown, roleId: unknown): boolean {
  return typeof roleId === "string" && promotionRoleAllowlist(family).some(role => role.roleId === roleId);
}

export function assertPromotionRoleAllowed(family: unknown, roleId: unknown): void {
  if (!isPromotionRoleAllowed(family, roleId)) throw new Error("Эта Discord-роль недоступна для повышений выбранной семьи.");
}

/** Preserve Discord labels/positions and earlier safety checks; match by ID, never by name. */
export function filterPromotionRoles<T extends { id: string }>(roles: readonly T[], family: unknown): T[] {
  return promotionRoleAllowlist(family).flatMap(allowed => {
    const role = roles.find(candidate => candidate.id === allowed.roleId);
    return role ? [role] : [];
  });
}
