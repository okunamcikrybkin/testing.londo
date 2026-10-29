const DISCORD_ID_PATTERN = /(?<!\d)\d{17,20}(?!\d)/g;

export function parseFullAccessDiscordIds(value: string | undefined): Set<string> {
  return new Set(value?.match(DISCORD_ID_PATTERN) ?? []);
}
