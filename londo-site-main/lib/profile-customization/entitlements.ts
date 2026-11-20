const BADGE_RANKS: Record<string, string> = { MAIN: "MAIN", MEMPHIS_RECRUIT: "RECRUIT MEMPHIS", MEMPHIS_CUR_RECRUIT: "КУРАТОР РЕКРУТОВ", MEMPHIS_HIGH_STAFF: "HIGH STAFF", MEMPHIS_DEP_OWNER: "DEP. OWNER" };

export function badgeEntitlements(role: string, memberships: readonly {family: string; rankRoleId: string | null}[], ranks: readonly {key: string; roleId: string}[]) {
  const badges = new Set<string>();
  if (memberships.length) badges.add("LND");
  const badgeByRoleId = new Map(ranks.flatMap(rank => BADGE_RANKS[rank.key] ? [[rank.roleId, BADGE_RANKS[rank.key]] as const] : []));
  for (const membership of memberships) {
    badges.add(membership.family);
    const rank = badgeByRoleId.get(membership.rankRoleId ?? "");
    if (rank) badges.add(rank);
  }
  if (role === "OWNER") badges.add("OWNER");
  return [...badges];
}
