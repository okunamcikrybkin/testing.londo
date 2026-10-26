import { FAMILY_RANKS } from "../rank-appearance/catalog";
import type { UserRole } from "../permissions/rbac";

export type FamilyAccess = { MEMPHIS: UserRole; PHOENIX: UserRole };
const staffKeys: Record<string, UserRole> = {
  OWNER: "OWNER",
  MEMPHIS_LEADER: "HIGH_STAFF",
  MEMPHIS_HIGH_STAFF: "RECRUIT",
  MEMPHIS_DEP_OWNER: "RECRUIT",
  MEMPHIS_CUR_RECRUIT: "RECRUIT",
  MEMPHIS_RECRUIT: "RECRUIT",
};
const priority = { USER: 0, RECRUIT: 1, HIGH_STAFF: 2, OWNER: 3 };
export function resolveDiscordAccess(roleIds: readonly string[]) {
  const ids = new Set(roleIds);
  const familyAccess: FamilyAccess = { MEMPHIS: "USER", PHOENIX: "USER" };
  let role: UserRole = "USER";
  for (const rank of FAMILY_RANKS) {
    const access = staffKeys[rank.key];
    if (!access || !ids.has(rank.roleId)) continue;
    if (priority[access] > priority[role]) role = access;
    for (const family of rank.scopes) {
      if (priority[access] > priority[familyAccess[family]]) familyAccess[family] = access;
    }
  }
  return { role, familyAccess };
}
export function resolveDiscordSiteRole(roleIds: readonly string[]): UserRole {
  return resolveDiscordAccess(roleIds).role;
}
