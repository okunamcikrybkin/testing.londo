import type { Family } from "../types/family.js";

export type FamilyRankDefinition = {
  key: string;
  label: string;
  priority: number;
  roleId: string;
  scopes: readonly Family[];
  roleNames?: readonly string[];
};

const BOTH_FAMILIES = ["MEMPHIS"] as const;
export const FAMILY_RANK_ENV_NAMES = [
  "OWNER_ROLE_ID",
  "MEMPHIS_DEP_OWNER_ROLE_ID",
  "MEMPHIS_HIGH_STAFF_ROLE_ID",
  "MEMPHIS_CUR_RECRUIT_ROLE_ID",
  "MEMPHIS_RECRUIT_ROLE_ID",
  "MAIN_ROLE_ID",
  "LONDEST_LONDO_ROLE_ID",
  "LONDO_ROLE_ID",
  "YOUNG_LONDO_ROLE_ID",
  "BABY_LONDO_ROLE_ID",
  "NEWBIE_ROLE_ID",
] as const;

function configuredRoleId(name: typeof FAMILY_RANK_ENV_NAMES[number]): string {
  const value = process.env[name]?.trim() ?? "";
  if (!/^\d{17,20}$/.test(value)) throw new Error(`${name} must be configured with a Discord snowflake.`);
  return value;
}

/**
 * Canonical roster rank mapping. Only roles listed here can resolve a rank;
 * Discord role position and unconfigured roles (including Legend) are ignored.
 */
const ranks: readonly (Omit<FamilyRankDefinition, "roleId"> & { envName: typeof FAMILY_RANK_ENV_NAMES[number] })[] = [
  { key: "OWNER", label: "Owner", priority: 12, envName: "OWNER_ROLE_ID", scopes: BOTH_FAMILIES, roleNames: ["owner"] },
  { key: "MEMPHIS_DEP_OWNER", label: "Dep. Owner (MEM)", priority: 10, envName: "MEMPHIS_DEP_OWNER_ROLE_ID", scopes: ["MEMPHIS"], roleNames: ["depowner", "deputyowner"] },
  { key: "MEMPHIS_HIGH_STAFF", label: "High Staff (MEM)", priority: 9, envName: "MEMPHIS_HIGH_STAFF_ROLE_ID", scopes: ["MEMPHIS"], roleNames: ["highstaff"] },
  { key: "MEMPHIS_CUR_RECRUIT", label: "Cur. Recruit (MEM)", priority: 8, envName: "MEMPHIS_CUR_RECRUIT_ROLE_ID", scopes: ["MEMPHIS"], roleNames: ["currecruit", "currentrecruit"] },
  { key: "MEMPHIS_RECRUIT", label: "Recruit (MEM)", priority: 7, envName: "MEMPHIS_RECRUIT_ROLE_ID", scopes: ["MEMPHIS"], roleNames: ["recruit"] },
  { key: "MAIN", label: "Main", priority: 6, envName: "MAIN_ROLE_ID", scopes: BOTH_FAMILIES, roleNames: ["main"] },
  { key: "LONDEST_LONDO", label: "Londest Londo", priority: 5, envName: "LONDEST_LONDO_ROLE_ID", scopes: BOTH_FAMILIES, roleNames: ["londestlondo"] },
  { key: "LONDO", label: "Londo", priority: 4, envName: "LONDO_ROLE_ID", scopes: BOTH_FAMILIES, roleNames: ["londo"] },
  { key: "YOUNG_LONDO", label: "Young Londo", priority: 3, envName: "YOUNG_LONDO_ROLE_ID", scopes: BOTH_FAMILIES, roleNames: ["younglondo"] },
  { key: "BABY_LONDO", label: "Baby Londo", priority: 2, envName: "BABY_LONDO_ROLE_ID", scopes: BOTH_FAMILIES, roleNames: ["babylondo"] },
  { key: "NEWBIE", label: "Newbie", priority: 1, envName: "NEWBIE_ROLE_ID", scopes: BOTH_FAMILIES, roleNames: ["newbie"] },
];

export const FAMILY_RANKS: readonly FamilyRankDefinition[] = ranks.map(({ envName, ...rank }) => ({
  ...rank,
  roleId: configuredRoleId(envName),
}));
if (new Set(FAMILY_RANKS.map(rank => rank.roleId)).size !== FAMILY_RANKS.length) {
  throw new Error("Configured family rank role IDs must be distinct.");
}
