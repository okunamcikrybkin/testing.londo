export const DISCORD_OAUTH_SCOPES = ["identify"] as const;

export type DiscordOAuthScope = (typeof DISCORD_OAUTH_SCOPES)[number];

export type DiscordIdentity = {
  discordId: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
};

export function discordAvatarUrl(
  discordId: string,
  avatarHash: string | null,
): string | null {
  if (!avatarHash) {
    return null;
  }

  const format = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${format}`;
}
