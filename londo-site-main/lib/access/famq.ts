import { FAMILY_RANKS } from "../rank-appearance/catalog";
export type MemberFamily = "MEMPHIS";
// Existing IDs verified against the bot's current configuration; no name matching.
export const DEFAULT_MEMBERSHIP_ROLES = {fam:"1545123264626430067",memphis:"1545123264626430066"};
export function membershipRoleIds(){return {
 fam:process.env.FAM_ROLE_ID?.trim()||DEFAULT_MEMBERSHIP_ROLES.fam,
 memphis:process.env.MEMPHIS_ROLE_ID?.trim()||DEFAULT_MEMBERSHIP_ROLES.memphis,
};}
const rankKeys=new Set(["NEWBIE","BABY_LONDO","YOUNG_LONDO","LONDO","LONDEST_LONDO","MAIN"]);
export const FAMQ_RANK_IDS=FAMILY_RANKS.filter(rank=>rankKeys.has(rank.key)).map(rank=>rank.roleId);
export function resolveFamqFamilies(roleIds:unknown, config=membershipRoleIds()):MemberFamily[]{
 if(!Array.isArray(roleIds)||new Set(Object.values(config)).size!==2||Object.values(config).some(id=>!/^\d{17,20}$/.test(id)))return [];
 const ids=new Set(roleIds.filter((id):id is string=>typeof id==="string"));
 if(!ids.has(config.fam)||!FAMQ_RANK_IDS.some(id=>ids.has(id)))return [];
 return ids.has(config.memphis)?["MEMPHIS"]:[];
}
