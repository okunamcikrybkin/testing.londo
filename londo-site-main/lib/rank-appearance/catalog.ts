import { FAMILY_RANK_ENV_NAMES, FAMILY_RANK_METADATA, type FamilyRankDefinition, type FamilyRankEnvName } from "./metadata";

export { FAMILY_RANK_ENV_NAMES };
export type { FamilyRankDefinition };

function configuredRoleId(name: FamilyRankEnvName): string {
  const value = process.env[name]?.trim() ?? "";
  if (!/^\d{17,20}$/.test(value)) throw new Error(`${name} must be configured with a Discord snowflake.`);
  return value;
}

/**
 * Canonical roster rank mapping. Only roles listed here can resolve a rank;
 * Discord role position and unconfigured roles (including Legend) are ignored.
 */
export const FAMILY_RANKS: readonly FamilyRankDefinition[] = FAMILY_RANK_METADATA.map(({ envName, ...rank }) => ({
  ...rank,
  roleId: configuredRoleId(envName),
}));
if (new Set(FAMILY_RANKS.map(rank => rank.roleId)).size !== FAMILY_RANKS.length) {
  throw new Error("Configured family rank role IDs must be distinct.");
}
