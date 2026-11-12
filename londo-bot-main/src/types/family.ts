export const FAMILIES = ["MEMPHIS"] as const;
export type ActiveFamily = (typeof FAMILIES)[number];

/** PHOENIX remains in the type for old stored records; runtime operations use FAMILIES. */
export type Family = "MEMPHIS" | "PHOENIX";

export type FamilyRoleIds = {
  fam: string;
  memphis: string;
};

export type DiscordConfig = {
  botToken: string;
  guildId: string;
  roles: FamilyRoleIds;
};

export type ApplicationConfig = {
  applicationChannelId: string;
  callCategoryId: string;
  port: number;
  staffRoleIds: Record<ActiveFamily, string[]>;
  acceptRoleIds: Record<ActiveFamily, string[]>;
};

export type ApplicationEmojiIds = Record<ActiveFamily, string | null>;

export type VoiceConfig = { afkChannelId: string | null };

export type TemporaryVoiceConfig = {
  panelChannelId: string;
  triggerChannelId: string;
  categoryId: string;
};

export type LeaderboardConfig = {
  channelId: string | null;
  messageId: string | null;
};

export type WelcomeConfig = {
  applicationChannelId: string | null;
  channelId: string | null;
};

export type GuideConfig = {
  applicationChannelId: string | null;
  channelId: string | null;
  channels: { guestChat: string | null; navigation: string | null; news: string | null; videos: string | null; voiceGuest: string | null };
  messageId: string | null;
  ownerName: string | null;
  urls: { application: string | null; law: string | null; registration: string | null; telegram: string | null };
};

export type TwitchConfig = {
  clientId: string;
  clientSecret: string;
  famMentionRoleId: string;
  streamChannelId: string;
};

export type TwitchAnnouncementConfig = {
  famMentionRoleId: string;
  streamChannelId: string;
};
