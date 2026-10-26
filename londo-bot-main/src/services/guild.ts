import { DiscordAPIError, type Client, type Guild } from "discord.js";
import type { DiscordConfig } from "../types/family.js";

export type FamilyRoleName = "MEMPHIS" | "FAM";

export class GuildNotFoundError extends Error {
  constructor() {
    super("Guild not found.");
  }
}

export class FamilyRoleNotFoundError extends Error {
  constructor(readonly roleName: FamilyRoleName) {
    super(`${roleName} role not found.`);
  }
}

function isUnknownGuildError(error: unknown): boolean {
  return error instanceof DiscordAPIError && error.code === 10004;
}

export async function getConfiguredGuild(client: Client, config: DiscordConfig): Promise<Guild> {
  let guild: Guild;

  try {
    guild = await client.guilds.fetch(config.guildId);
  } catch (error) {
    if (isUnknownGuildError(error)) {
      throw new GuildNotFoundError();
    }

    throw error;
  }

  await guild.roles.fetch();

  const roleChecks: ReadonlyArray<{ id: string; name: FamilyRoleName }> = [
    { id: config.roles.memphis, name: "MEMPHIS" },
    { id: config.roles.fam, name: "FAM" },
  ];

  for (const role of roleChecks) {
    if (!guild.roles.cache.has(role.id)) {
      throw new FamilyRoleNotFoundError(role.name);
    }
  }

  return guild;
}
