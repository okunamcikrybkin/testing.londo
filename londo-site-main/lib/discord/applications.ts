import type { Family } from "@prisma/client";
import { discordApi, DiscordIntegrationError } from "@/lib/discord/client";

type FamilyDiscordConfig = {
  acceptRoleIds: string[];
  applicationCategoryId: string;
  guildId: string;
  staffRoleIds: string[];
};

type DiscordChannel = { id: string };

function parseIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id) => /^\d{16,22}$/.test(id));
}

function readDiscordId(value: string | undefined, name: string): string {
  if (!value || !/^\d{16,22}$/.test(value)) {
    throw new DiscordIntegrationError(`Discord integration is not configured: ${name}.`);
  }

  return value;
}

function getFamilyConfig(family: Family, requiresAcceptRoles = false): FamilyDiscordConfig {
  const prefix = family === "MEMPHIS" ? "MEMPHIS" : "PHOENIX";
  const config: FamilyDiscordConfig = {
    acceptRoleIds: parseIds(process.env[`${prefix}_ACCEPT_ROLE_IDS`]),
    applicationCategoryId: readDiscordId(
      process.env[`${prefix}_APPLICATION_CATEGORY_ID`],
      `${prefix}_APPLICATION_CATEGORY_ID`,
    ),
    guildId: readDiscordId(process.env.DISCORD_GUILD_ID, "DISCORD_GUILD_ID"),
    staffRoleIds: parseIds(process.env[`${prefix}_STAFF_ROLE_IDS`]),
  };

  if (config.staffRoleIds.length === 0) {
    throw new DiscordIntegrationError(`Discord integration is not configured: ${prefix}_STAFF_ROLE_IDS.`);
  }

  if (requiresAcceptRoles && config.acceptRoleIds.length === 0) {
    throw new DiscordIntegrationError(`Discord integration is not configured: ${prefix}_ACCEPT_ROLE_IDS.`);
  }

  return config;
}

function safeChannelFragment(value: string, discordUserId: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
  const suffix = discordUserId.slice(-4);
  return `${cleaned || "member"}-${suffix}`;
}

function channelOverwrites(discordUserId: string, staffRoleIds: string[]) {
  return [
    { allow: "0", deny: "1024", id: "0", type: 0 },
    { allow: "1024", deny: "0", id: discordUserId, type: 1 },
    ...staffRoleIds.map((id) => ({ allow: "1024", deny: "0", id, type: 0 })),
  ];
}

async function createChannel(
  config: FamilyDiscordConfig,
  name: string,
  type: 0 | 2,
  discordUserId: string,
): Promise<DiscordChannel> {
  return discordApi<DiscordChannel>(`/guilds/${config.guildId}/channels`, {
    body: JSON.stringify({
      name,
      parent_id: config.applicationCategoryId,
      permission_overwrites: channelOverwrites(discordUserId, config.staffRoleIds),
      type,
    }),
    method: "POST",
  });
}

export async function createApplicationChannels(input: {
  discordUserId: string;
  family: Family;
  username: string;
}): Promise<{ textChannelId: string; voiceChannelId: string }> {
  const config = getFamilyConfig(input.family);
  const fragment = safeChannelFragment(input.username, input.discordUserId);
  const textChannel = await createChannel(
    config,
    `application-${fragment}`,
    0,
    input.discordUserId,
  );

  try {
    const voiceChannel = await createChannel(
      config,
      `call-${fragment}`,
      2,
      input.discordUserId,
    );
    return { textChannelId: textChannel.id, voiceChannelId: voiceChannel.id };
  } catch (error) {
    await closeApplicationChannels({ textChannelId: textChannel.id, voiceChannelId: null });
    throw error;
  }
}

export async function assignFamilyRoles(input: {
  discordUserId: string;
  family: Family;
}): Promise<void> {
  const config = getFamilyConfig(input.family, true);
  const grantedRoleIds: string[] = [];

  try {
    for (const roleId of config.acceptRoleIds) {
      await discordApi<void>(
        `/guilds/${config.guildId}/members/${input.discordUserId}/roles/${roleId}`,
        { method: "PUT" },
      );
      grantedRoleIds.push(roleId);
    }
  } catch (error) {
    await Promise.allSettled(
      grantedRoleIds.map((roleId) =>
        discordApi<void>(
          `/guilds/${config.guildId}/members/${input.discordUserId}/roles/${roleId}`,
          { method: "DELETE" },
        ),
      ),
    );
    throw error;
  }
}

export async function closeApplicationChannels(input: {
  textChannelId: string | null;
  voiceChannelId: string | null;
}): Promise<void> {
  const channelIds = [input.textChannelId, input.voiceChannelId].filter(
    (id): id is string => Boolean(id && /^\d{16,22}$/.test(id)),
  );

  await Promise.allSettled(
    channelIds.map((channelId) => discordApi<void>(`/channels/${channelId}`, { method: "DELETE" })),
  );
}
