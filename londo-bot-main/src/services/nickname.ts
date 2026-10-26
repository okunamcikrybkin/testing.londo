export type ParsedRosterNickname = {
  gameNickname: string;
  staticId: string | null;
};

/** Parses the first pipe in a Discord nickname while preserving malformed values safely. */
export function parseRosterNickname(nickname: string | null, displayName: string): ParsedRosterNickname {
  const fallback = displayName.trim() || nickname?.trim() || "Unknown";
  const source = (nickname ?? displayName).trim();
  const separator = source.indexOf("|");
  if (separator < 0) return { gameNickname: source || fallback, staticId: null };

  const gameNickname = source.slice(0, separator).trim();
  const staticId = source.slice(separator + 1).trim();
  return { gameNickname: gameNickname || fallback, staticId: staticId || null };
}
