import { FAMILY_RANKS } from "../rank-appearance/catalog";
import type { UserRole } from "../permissions/rbac";
import { configuredRoleIds } from "./discord-roles";

export type FamilyAccess = { MEMPHIS: UserRole; PHOENIX: UserRole };
const staffKeys: Record<string, UserRole> = {
  OWNER: "OWNER",
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
  const apply = (access: UserRole, families: readonly ("MEMPHIS" | "PHOENIX")[]) => {
    if (priority[access] > priority[role]) role = access;
    for (const family of families) {
      if (priority[access] > priority[familyAccess[family]]) familyAccess[family] = access;
    }
  };
  for (const rank of FAMILY_RANKS) {
    const access = staffKeys[rank.key];
    if (!access || !ids.has(rank.roleId)) continue;
    apply(access, rank.scopes);
  }
  for (const id of configuredRoleIds("DISCORD_RECRUIT_ROLE_IDS")) if (ids.has(id)) apply("RECRUIT", ["MEMPHIS"]);
  for (const id of configuredRoleIds("DISCORD_HIGH_STAFF_ROLE_IDS")) if (ids.has(id)) apply("HIGH_STAFF", ["MEMPHIS"]);
  return { role, familyAccess };
}
export function resolveDiscordSiteRole(roleIds: readonly string[]): UserRole {
  return resolveDiscordAccess(roleIds).role;
}
