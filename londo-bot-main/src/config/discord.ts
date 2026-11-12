import "dotenv/config";
import type { ApplicationConfig, ApplicationEmojiIds, DiscordConfig, GuideConfig, LeaderboardConfig, TemporaryVoiceConfig, TwitchAnnouncementConfig, TwitchConfig, VoiceConfig, WelcomeConfig } from "../types/family.js";
import { FAMILY_RANK_ENV_NAMES } from "./familyRanks.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }

  return value;
}

function discordId(name: string): string {
  const value = requiredEnvironment(name);

  if (!/^\d{17,20}$/.test(value)) {
    throw new Error(`Invalid Discord ID configured for ${name}.`);
  }

  return value;
}

function optionalRoleIds(name: string): string[] {
  const ids = (process.env[name] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (ids.some((id) => !/^\d{17,20}$/.test(id))) throw new Error(`Invalid Discord ID configured for ${name}.`);
  return [...new Set(ids)];
}

function optionalDiscordId(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  if (!/^\d{17,20}$/.test(value)) throw new Error(`Invalid Discord ID configured for ${name}.`);
  return value;
}

function optionalHttpUrl(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch { throw new Error(`Invalid URL configured for ${name}.`); }
}

export function loadDiscordConfig(): DiscordConfig {
  for (const name of FAMILY_RANK_ENV_NAMES) discordId(name);
  const roles = {
    fam: discordId("FAM_ROLE_ID"),
    memphis: discordId("MEMPHIS_ROLE_ID"),
  };

  if (new Set(Object.values(roles).filter(Boolean)).size !== Object.values(roles).filter(Boolean).length) {
    throw new Error("Family role IDs must be distinct.");
  }

  return {
    botToken: requiredEnvironment("DISCORD_BOT_TOKEN"),
    guildId: discordId("DISCORD_GUILD_ID"),
    roles,
  };
}

export function loadBirthdayConfig(): { roleId: string; channelId: string } | null {
  const roleId = optionalDiscordId("BIRTHDAY_ROLE_ID");
  const channelId = optionalDiscordId("BIRTHDAY_CHANNEL_ID");
  if (!roleId && !channelId) return null;
  if (!roleId || !channelId) throw new Error("Birthday configuration is incomplete. Set both BIRTHDAY_ROLE_ID and BIRTHDAY_CHANNEL_ID.");
  return { roleId, channelId };
}

export function loadInternalApiSecret(): string {
  return requiredEnvironment("LONDO_BOT_API_SECRET");
}

/** Loads application-only settings lazily so roster startup stays independent. */
export function loadApplicationConfig(): ApplicationConfig {
  const port = Number(process.env.LONDO_BOT_INTERNAL_PORT ?? "3101");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid LONDO_BOT_INTERNAL_PORT.");
  return {
    applicationChannelId: discordId("APPLICATION_CHANNEL_ID"),
    callCategoryId: discordId("APPLICATION_CALL_CATEGORY_ID"),
    port,
    staffRoleIds: { MEMPHIS: optionalRoleIds("MEMPHIS_STAFF_ROLE_IDS") },
    acceptRoleIds: { MEMPHIS: optionalRoleIds("MEMPHIS_ACCEPT_ROLE_IDS") },
  };
}

/** Loads optional custom emoji IDs for the application family selector. */
export function loadApplicationEmojiIds(): ApplicationEmojiIds {
  return { MEMPHIS: optionalDiscordId("MEMPHIS_APPLICATION_EMOJI_ID") };
}

export function loadVoiceConfig(): VoiceConfig { return { afkChannelId: optionalDiscordId("FAMILY_AFK_CHANNEL_ID") }; }

export function loadTemporaryVoiceConfig(): TemporaryVoiceConfig | null {
  const panelChannelId = optionalDiscordId("TEMPORARY_VOICE_PANEL_CHANNEL_ID");
  const triggerChannelId = optionalDiscordId("TEMPORARY_VOICE_TRIGGER_CHANNEL_ID");
  const categoryId = optionalDiscordId("TEMPORARY_VOICE_CATEGORY_ID");

  if (!panelChannelId && !triggerChannelId && !categoryId) return null;
  if (!panelChannelId || !triggerChannelId || !categoryId) {
    throw new Error("Temporary voice configuration is incomplete. Set all three TEMPORARY_VOICE_*_ID variables.");
  }
  if (new Set([panelChannelId, triggerChannelId, categoryId]).size !== 3) {
    throw new Error("Temporary voice channel IDs must be distinct.");
  }

  return { panelChannelId, triggerChannelId, categoryId };
}

/** Leaderboard remains optional so a missing channel never blocks bot startup. */
export function loadLeaderboardConfig(): LeaderboardConfig {
  return { channelId: optionalDiscordId("LEADERBOARD_CHANNEL_ID"), messageId: optionalDiscordId("LEADERBOARD_MESSAGE_ID") };
}

/** Welcome settings are optional and never prevent ordinary bot startup. */
export function loadWelcomeConfig(): WelcomeConfig {
  return { applicationChannelId: optionalDiscordId("APPLICATION_CHANNEL_ID"), channelId: optionalDiscordId("WELCOME_CHANNEL_ID") };
}

export function loadGuideConfig(): GuideConfig {
  return {
    applicationChannelId: optionalDiscordId("APPLICATION_CHANNEL_ID"),
    channelId: optionalDiscordId("GUIDE_CHANNEL_ID"),
    channels: { guestChat: optionalDiscordId("GUEST_CHAT_CHANNEL_ID"), navigation: optionalDiscordId("NAVIGATION_CHANNEL_ID"), news: optionalDiscordId("NEWS_CHANNEL_ID"), videos: optionalDiscordId("VIDEOS_CHANNEL_ID"), voiceGuest: optionalDiscordId("VOICE_GUEST_CHANNEL_ID") },
    messageId: optionalDiscordId("GUIDE_MESSAGE_ID"),
    ownerName: process.env.GUIDE_OWNER_NAME?.trim() || null,
    urls: { application: optionalHttpUrl("GUIDE_APPLICATION_URL"), law: optionalHttpUrl("GUIDE_LAW_URL"), registration: optionalHttpUrl("GUIDE_REGISTRATION_URL"), telegram: optionalHttpUrl("GUIDE_TELEGRAM_URL") },
  };
}

/** Twitch is opt-in: incomplete settings disable only the watcher and commands' data operations. */
export function loadTwitchConfig(famRoleId: string): TwitchConfig | null {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
  const streamChannelId = process.env.TWITCH_STREAM_CHANNEL_ID?.trim();
  const mentionRole = process.env.TWITCH_FAM_MENTION_ROLE_ID?.trim() || famRoleId;
  if (!clientId && !clientSecret && !streamChannelId) return null;
  if (!clientId || !clientSecret || !streamChannelId) throw new Error("Twitch configuration is incomplete.");
  if (!/^\d{17,20}$/.test(streamChannelId) || !/^\d{17,20}$/.test(mentionRole)) throw new Error("Invalid Discord ID configured for Twitch.");
  return { clientId, clientSecret, streamChannelId, famMentionRoleId: mentionRole };
}

/** The visual test requires a channel, but intentionally does not require Twitch API credentials. */
export function loadTwitchAnnouncementConfig(famRoleId: string): TwitchAnnouncementConfig | null {
  const streamChannelId = process.env.TWITCH_STREAM_CHANNEL_ID?.trim();
  if (!streamChannelId) return null;
  const famMentionRoleId = process.env.TWITCH_FAM_MENTION_ROLE_ID?.trim() || famRoleId;
  if (!/^\d{17,20}$/.test(streamChannelId) || !/^\d{17,20}$/.test(famMentionRoleId)) throw new Error("Invalid Discord ID configured for Twitch.");
  return { famMentionRoleId, streamChannelId };
}
