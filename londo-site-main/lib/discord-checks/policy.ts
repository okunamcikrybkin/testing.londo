export const CHECK_SCOPES = "identify guilds guilds.members.read";
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const LONDO_GUILD_ID = "1545123264605585438";
export type GuildResult = { id: string; name: string; icon: string | null; roles: string[] | null; roleStatus: "NOT_CHECKED" | "AVAILABLE" | "UNAVAILABLE" | "MISSING_SCOPE" | "API_ERROR" | "RATE_LIMITED" | "RECONSENT_REQUIRED"; roleHttpStatus?: number; roleErrorCode?: number; roleSource?: "OAUTH" | "BOT"; roleCheckedAt?: string; roleRetryAt?: string; roleNames?: Record<string,string> };
export function matchGuilds(guilds: GuildResult[], watchlist: { guildId: string; enabled: boolean }[]) {
  const ids = new Set(watchlist.filter(row => row.enabled).map(row => row.guildId));
  return guilds.map(guild => ({ ...guild, matched: ids.has(guild.id) })).sort((a,b) => Number(b.matched)-Number(a.matched) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function publicApplyUrl(value = process.env.PUBLIC_SITE_URL): string | null {
  try { const url = new URL(value ?? ""); if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".") || /^(localhost|127\.|0\.|\[|10\.|192\.168\.)/.test(url.hostname) || url.hostname.endsWith(".localhost")) return null; return new URL("/apply",url.origin).href; } catch { return null; }
}
export function validateWatchlist(value: unknown) {
  if (!value || typeof value !== "object") throw Error("Некорректные данные сервера.");
  const b = value as Record<string, unknown>;
  if (typeof b.guildId !== "string" || !/^\d{17,20}$/.test(b.guildId) || typeof b.name !== "string" || !b.name.trim() || b.name.trim().length > 100 || typeof b.enabled !== "boolean") throw Error("Укажите Guild ID, название и статус.");
  let inviteUrl: string | null = null;
  if (b.inviteUrl) { try { const u = new URL(String(b.inviteUrl)); if (u.protocol !== "https:" || u.username || u.password || !((u.hostname === "discord.gg" && /^\/[\w-]+$/.test(u.pathname)) || (u.hostname === "discord.com" && /^\/invite\/[\w-]+$/.test(u.pathname)))) throw Error(); inviteUrl = u.href; } catch { throw Error("Укажите официальную https invite-ссылку Discord."); } }
  return { guildId:b.guildId, name:b.name.trim(), enabled:b.enabled, inviteUrl };
}

export const ROLE_CACHE_MS = 5 * 60 * 1000;
export const ROLE_BATCH_LIMIT = 5;
export function hasFreshRoles(row: GuildResult, now=Date.now()) {
 const checked=Date.parse(row.roleCheckedAt??"");
 return row.roleStatus==="AVAILABLE" && Array.isArray(row.roles) && Number.isFinite(checked) && checked<=now && now-checked<ROLE_CACHE_MS;
}
export function visibleRoles(row:GuildResult,now=Date.now()):GuildResult {
 if(hasFreshRoles(row,now))return row;
 if(row.roleStatus==="AVAILABLE"||!row.roleCheckedAt)return {id:row.id,name:row.name,icon:row.icon,roles:null,roleStatus:"NOT_CHECKED"};
 return {...row,roles:null};
}
