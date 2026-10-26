// Mirrors the existing canonical bot roster mapping; website presentation only.
type Family = "MEMPHIS";

export type FamilyRankDefinition = {
  key: string;
  label: string;
  priority: number;
  roleId: string;
  scopes: readonly Family[];
};

const BOTH_FAMILIES = ["MEMPHIS"] as const;

/**
 * Canonical roster rank mapping. Only roles listed here can resolve a rank;
 * Discord role position and unconfigured roles (including Legend) are ignored.
 */
export const FAMILY_RANKS: readonly FamilyRankDefinition[] = [
  { key: "OWNER", label: "Owner", priority: 12, roleId: "1545123264668369040", scopes: BOTH_FAMILIES },
  { key: "MEMPHIS_LEADER", label: "Leader (MEM)", priority: 11, roleId: "1545453391537242232", scopes: ["MEMPHIS"] },
  { key: "MEMPHIS_DEP_OWNER", label: "Dep. Owner (MEM)", priority: 10, roleId: "1545123264655794264", scopes: ["MEMPHIS"] },
  { key: "MEMPHIS_HIGH_STAFF", label: "High Staff (MEM)", priority: 9, roleId: "1545123264643473528", scopes: ["MEMPHIS"] },
  { key: "MEMPHIS_CUR_RECRUIT", label: "Cur. Recruit (MEM)", priority: 8, roleId: "1545123264643473526", scopes: ["MEMPHIS"] },
  { key: "MEMPHIS_RECRUIT", label: "Recruit (MEM)", priority: 7, roleId: "1545123264643473524", scopes: ["MEMPHIS"] },
  { key: "MAIN", label: "Main", priority: 6, roleId: "1545123264643473521", scopes: BOTH_FAMILIES },
  { key: "LONDEST_LONDO", label: "Londest Londo", priority: 5, roleId: "1545123264643473520", scopes: BOTH_FAMILIES },
  { key: "LONDO", label: "Londo", priority: 4, roleId: "1545123264643473519", scopes: BOTH_FAMILIES },
  { key: "YOUNG_LONDO", label: "Young Londo", priority: 3, roleId: "1545123264626430073", scopes: BOTH_FAMILIES },
  { key: "BABY_LONDO", label: "Baby Londo", priority: 2, roleId: "1545123264626430072", scopes: BOTH_FAMILIES },
  { key: "NEWBIE", label: "Newbie", priority: 1, roleId: "1545123264626430071", scopes: BOTH_FAMILIES },
];
