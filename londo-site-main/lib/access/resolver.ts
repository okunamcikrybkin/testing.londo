import { FAMILY_RANKS } from "../rank-appearance/catalog";
import type { UserRole } from "../permissions/rbac";
import { configuredRoleIds } from "./discord-roles";
import { ROLE_ORDER } from "./policy";

export type FamilyAccess = { MEMPHIS: UserRole; PHOENIX: UserRole };
const staffKeys: Record<string, UserRole> = {
  OWNER: "OWNER",
  MEMPHIS_HIGH_STAFF: "HIGH_STAFF",
  MEMPHIS_DEP_OWNER: "DEP_OWNER",
  MEMPHIS_CUR_RECRUIT: "CURATOR",
  MEMPHIS_RECRUIT: "RECRUIT",
};
export function resolveDiscordAccess(roleIds: readonly string[]) {
  const ids = new Set(roleIds);
  const familyAccess: FamilyAccess = { MEMPHIS: "USER", PHOENIX: "USER" };
  let role: UserRole = "USER";
  const apply = (access: UserRole, families: readonly ("MEMPHIS" | "PHOENIX")[]) => {
    if (!families.includes("MEMPHIS")) return;
    if (ROLE_ORDER[access] > ROLE_ORDER[role]) role = access;
    if (ROLE_ORDER[access] > ROLE_ORDER[familyAccess.MEMPHIS]) familyAccess.MEMPHIS = access;
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
export function hasRecruitCuratorRole(roleIds: readonly string[]) {
  const curatorRoleId = FAMILY_RANKS.find(rank => rank.key === "MEMPHIS_CUR_RECRUIT")?.roleId;
  return Boolean(curatorRoleId && roleIds.includes(curatorRoleId));
}
export function resolveDiscordSiteRole(roleIds: readonly string[]): UserRole {
  return resolveDiscordAccess(roleIds).role;
}
