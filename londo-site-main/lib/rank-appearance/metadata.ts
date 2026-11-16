export type Family = "MEMPHIS";

export type FamilyRankDefinition = {
  key: string;
  label: string;
  priority: number;
  roleId: string;
  scopes: readonly Family[];
};

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

export type FamilyRankEnvName = typeof FAMILY_RANK_ENV_NAMES[number];
export type FamilyRankMetadata = Omit<FamilyRankDefinition, "roleId"> & { envName: FamilyRankEnvName };

const BOTH_FAMILIES = ["MEMPHIS"] as const;

export const FAMILY_RANK_METADATA: readonly FamilyRankMetadata[] = [
  { key: "OWNER", label: "Owner", priority: 12, envName: "OWNER_ROLE_ID", scopes: BOTH_FAMILIES },
  { key: "MEMPHIS_DEP_OWNER", label: "Dep. Owner (MEM)", priority: 10, envName: "MEMPHIS_DEP_OWNER_ROLE_ID", scopes: ["MEMPHIS"] },
  { key: "MEMPHIS_HIGH_STAFF", label: "High Staff (MEM)", priority: 9, envName: "MEMPHIS_HIGH_STAFF_ROLE_ID", scopes: ["MEMPHIS"] },
  { key: "MEMPHIS_CUR_RECRUIT", label: "Cur. Recruit (MEM)", priority: 8, envName: "MEMPHIS_CUR_RECRUIT_ROLE_ID", scopes: ["MEMPHIS"] },
  { key: "MEMPHIS_RECRUIT", label: "Recruit (MEM)", priority: 7, envName: "MEMPHIS_RECRUIT_ROLE_ID", scopes: ["MEMPHIS"] },
  { key: "MAIN", label: "Main", priority: 6, envName: "MAIN_ROLE_ID", scopes: BOTH_FAMILIES },
  { key: "LONDEST_LONDO", label: "Londest Londo", priority: 5, envName: "LONDEST_LONDO_ROLE_ID", scopes: BOTH_FAMILIES },
  { key: "LONDO", label: "Londo", priority: 4, envName: "LONDO_ROLE_ID", scopes: BOTH_FAMILIES },
  { key: "YOUNG_LONDO", label: "Young Londo", priority: 3, envName: "YOUNG_LONDO_ROLE_ID", scopes: BOTH_FAMILIES },
  { key: "BABY_LONDO", label: "Baby Londo", priority: 2, envName: "BABY_LONDO_ROLE_ID", scopes: BOTH_FAMILIES },
  { key: "NEWBIE", label: "Newbie", priority: 1, envName: "NEWBIE_ROLE_ID", scopes: BOTH_FAMILIES },
];
