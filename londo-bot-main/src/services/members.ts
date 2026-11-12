import type { GuildMember } from "discord.js";
import { FAMILIES, type ActiveFamily, type FamilyRoleIds } from "../types/family.js";
import { resolveFamilyRank, type ResolvedFamilyRank } from "./ranks.js";
import { parseRosterNickname } from "./nickname.js";

export type ActiveFamilyMembership = {
  active: true;
  discordUserId: string;
  family: ActiveFamily;
};

export type RosterMember = {
  avatarUrl: string | null;
  discordDisplayName: string;
  discordUserId: string;
  discordUsername: string;
  family: ActiveFamily;
  gameNickname: string;
  rank: ResolvedFamilyRank | null;
  staticId: string | null;
};

export type MemberRosterSync = Omit<RosterMember, "family" | "rank"> & {
  memberships: Array<{ active: boolean; family: ActiveFamily; rank: ResolvedFamilyRank | null }>;
};

/** Returns every active family membership represented by the member's Discord roles. */
export function getMemberFamilies(member: GuildMember, roles: FamilyRoleIds): ActiveFamily[] {
  if (!member.roles.cache.has(roles.fam)) {
    return [];
  }

  return FAMILIES.filter((family) => {
    return member.roles.cache.has(roles.memphis);
  });
}

/** Projects independent active memberships without assigning rank or balance state. */
export function getActiveFamilyMemberships(
  member: GuildMember,
  roles: FamilyRoleIds,
): ActiveFamilyMembership[] {
  return getMemberFamilies(member, roles).map((family) => ({
    active: true,
    discordUserId: member.id,
    family,
  }));
}

/** Filters an already-fetched member collection; this function never calls Discord. */
export function getFamilyMembers(
  members: Iterable<GuildMember>,
  family: ActiveFamily,
  roles: FamilyRoleIds,
): GuildMember[] {
  return Array.from(members).filter((member) => getMemberFamilies(member, roles).includes(family));
}

/** Builds one family-scoped roster from an already-fetched Discord member snapshot. */
export function getFamilyRoster(
  members: Iterable<GuildMember>,
  family: ActiveFamily,
  roles: FamilyRoleIds,
): RosterMember[] {
  return getFamilyMembers(members, family, roles).map((member) => ({
    ...parseRosterNickname(member.nickname, member.displayName),
    avatarUrl: member.displayAvatarURL({ extension: "png", size: 128 }),
    discordDisplayName: member.displayName,
    discordUserId: member.id,
    discordUsername: member.user.username,
    family,
    rank: resolveFamilyRank(member, family),
  }));
}

/** Projects both family memberships for one member, including explicit inactive states. */
export function getMemberRosterSync(member: GuildMember, roles: FamilyRoleIds): MemberRosterSync {
  const activeFamilies = new Set(getMemberFamilies(member, roles));
  const identity = {
    ...parseRosterNickname(member.nickname, member.displayName),
    avatarUrl: member.displayAvatarURL({ extension: "png", size: 128 }),
    discordDisplayName: member.displayName,
    discordUserId: member.id,
    discordUsername: member.user.username,
  };

  return {
    ...identity,
    memberships: FAMILIES.map((family) => {
      const active = activeFamilies.has(family);
      return { active, family, rank: active ? resolveFamilyRank(member, family) : null };
    }),
  };
}
