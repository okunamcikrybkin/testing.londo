/** Existing Discord IDs. This order belongs to the promotion role picker, not roster priority. */
const shared = {
  baby: { roleId: "1545123264626430072", order: 2 },
  young: { roleId: "1545123264626430073", order: 3 },
  londo: { roleId: "1545123264643473519", order: 4 },
  londest: { roleId: "1545123264643473520", order: 6 },
  main: { roleId: "1545123264643473521", order: 8 },
} as const;

export function promotionRoleAllowlist(family: unknown): readonly { roleId: string; order: number }[] {
  if (family !== "MEMPHIS") return [];
  const recruit = { roleId: "1545123264643473524", order: 5 };
  return [shared.baby, shared.young, shared.londo, recruit, shared.londest, shared.main];
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
