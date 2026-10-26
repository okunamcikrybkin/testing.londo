export class DiscordIntegrationError extends Error {}

function getBotToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new DiscordIntegrationError("Discord integration is not configured.");
  }

  return token;
}

export async function discordApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bot ${getBotToken()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new DiscordIntegrationError("Discord integration request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

type DiscordGuildMember = { roles?: unknown };

/** Returns role IDs from Discord's authoritative guild-member endpoint. */
export async function getDiscordMemberRoleIds(discordUserId: string): Promise<string[]> {
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!guildId) {
    throw new DiscordIntegrationError("Discord integration is not configured.");
  }

  const member = await discordApi<DiscordGuildMember>(
    `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}`,
  );

  return Array.isArray(member.roles)
    ? member.roles.filter((roleId): roleId is string => typeof roleId === "string")
    : [];
}
