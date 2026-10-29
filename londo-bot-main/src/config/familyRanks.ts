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

/**
 * Canonical roster rank mapping. Only roles listed here can resolve a rank;
 * Discord role position and unconfigured roles (including Legend) are ignored.
 */
export const FAMILY_RANKS: readonly FamilyRankDefinition[] = [
  { key: "OWNER", label: "Owner", priority: 12, roleId: "1545123264668369039", scopes: BOTH_FAMILIES, roleNames: ["owner"] },
  { key: "MEMPHIS_LEADER", label: "Leader (MEM)", priority: 11, roleId: "1545453391537242232", scopes: ["MEMPHIS"], roleNames: ["leader", "memphisleader"] },
  { key: "MEMPHIS_DEP_OWNER", label: "Dep. Owner (MEM)", priority: 10, roleId: "1545123264655794264", scopes: ["MEMPHIS"], roleNames: ["depowner", "deputyowner"] },
  { key: "MEMPHIS_HIGH_STAFF", label: "High Staff (MEM)", priority: 9, roleId: "1545123264643473528", scopes: ["MEMPHIS"], roleNames: ["highstaff"] },
  { key: "MEMPHIS_CUR_RECRUIT", label: "Cur. Recruit (MEM)", priority: 8, roleId: "1545123264643473526", scopes: ["MEMPHIS"], roleNames: ["currecruit", "currentrecruit"] },
  { key: "MEMPHIS_RECRUIT", label: "Recruit (MEM)", priority: 7, roleId: "1545123264643473524", scopes: ["MEMPHIS"], roleNames: ["recruit"] },
  { key: "MAIN", label: "Main", priority: 6, roleId: "1545123264643473521", scopes: BOTH_FAMILIES, roleNames: ["main"] },
  { key: "LONDEST_LONDO", label: "Londest Londo", priority: 5, roleId: "1545123264643473520", scopes: BOTH_FAMILIES, roleNames: ["londestlondo"] },
  { key: "LONDO", label: "Londo", priority: 4, roleId: "1545123264643473519", scopes: BOTH_FAMILIES, roleNames: ["londo"] },
  { key: "YOUNG_LONDO", label: "Young Londo", priority: 3, roleId: "1545123264626430073", scopes: BOTH_FAMILIES, roleNames: ["younglondo"] },
  { key: "BABY_LONDO", label: "Baby Londo", priority: 2, roleId: "1545123264626430072", scopes: BOTH_FAMILIES, roleNames: ["babylondo"] },
  { key: "NEWBIE", label: "Newbie", priority: 1, roleId: "1545123264626430071", scopes: BOTH_FAMILIES, roleNames: ["newbie"] },
];
