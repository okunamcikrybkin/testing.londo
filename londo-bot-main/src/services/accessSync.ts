import type { Guild, GuildMember } from "discord.js";
import { FAMILY_RANKS } from "../config/familyRanks.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { logWarning } from "../utils/logger.js";

type Trigger = "ROLE_UPDATE" | "STARTUP_RECONCILIATION" | "PERIODIC_RECONCILIATION" | "OAUTH";
export type AccessObservation = { discordId: string; roleIds: string[]; observedAt: string; trigger: Trigger };
const keys = new Set([
  "OWNER", "MEMPHIS_LEADER", "MEMPHIS_HIGH_STAFF", "MEMPHIS_DEP_OWNER",
  "MEMPHIS_CUR_RECRUIT", "MEMPHIS_RECRUIT",
]);
const accessRankIds = FAMILY_RANKS.filter(rank => keys.has(rank.key) || ["MAIN","LONDEST_LONDO","LONDO","YOUNG_LONDO","BABY_LONDO","NEWBIE"].includes(rank.key)).map(rank => rank.roleId);
function accessRoleIds(){return new Set([...accessRankIds,...[process.env.FAM_ROLE_ID,process.env.MEMPHIS_ROLE_ID].filter((id):id is string=>Boolean(id))]);}
export function accessRolesChanged(before: Iterable<string>, after: Iterable<string>): boolean {
  const watched=accessRoleIds();
  const key = (ids: Iterable<string>) => [...ids].filter(id => watched.has(id)).sort().join(",");
  return key(before) !== key(after);
}
export function observeAccess(member: Pick<GuildMember, "id" | "roles">, trigger: Trigger, observedAt = new Date().toISOString()): AccessObservation {
  const watched=accessRoleIds();
  return { discordId: member.id, roleIds: [...member.roles.cache.keys()].filter(id => watched.has(id)), trigger, observedAt };
}
type Transport = { fetch?: typeof fetch; delay?: (ms: number) => Promise<void> };
async function requestSite(config: SiteLogConfig, body: AccessObservation[] | undefined, transport: Transport) {
  for (const pause of [0, 300, 900]) {
    if (pause) await (transport.delay ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(pause);
    try {
      const result = await (transport.fetch ?? fetch)(new URL("/api/internal/access-sync", config.siteUrl), {
        method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-londo-bot-secret": config.apiSecret },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8_000),
      });
      if (result.ok) return await result.json() as unknown;
      if (result.status >= 400 && result.status < 500) break;
    } catch { /* Never turn failed transport into an empty roles snapshot. */ }
  }
  logWarning("[ACCESS] Sync unavailable; next reconciliation will retry.");
  return null;
}
export async function sendAccessObservations(config: SiteLogConfig, observations: AccessObservation[], transport: Transport = {}): Promise<boolean> {
  if (!observations.length) return true;
  return await requestSite(config, observations, transport) !== null;
}

/** Caller provides the same successful full fetch used by roster reconciliation. */
export async function reconcileAccess(config: SiteLogConfig, snapshot: AccessObservation[] | null, expectedCount: number, observedAt: string, trigger: "STARTUP_RECONCILIATION" | "PERIODIC_RECONCILIATION", transport: Transport = {}): Promise<boolean> {
  if (!snapshot || !snapshot.length || snapshot.length < expectedCount || Date.now() - Date.parse(observedAt) > 120_000) return false;
  const response = await requestSite(config, undefined, transport);
  if (!response || typeof response !== "object" || !("discordIds" in response) || !Array.isArray(response.discordIds) || response.discordIds.some(id => typeof id !== "string" || !/^\d{17,20}$/.test(id))) return false;
  const members = new Map(snapshot.map(member => [member.discordId, member]));
  // Only successful complete snapshots establish that a known site user has left the guild.
  const observations: AccessObservation[] = response.discordIds.map((discordId: string) => ({ discordId, roleIds: members.get(discordId)?.roleIds ?? [], observedAt, trigger }));
  let ok = true;
  for (let i = 0; i < observations.length; i += 50) {
    if (!await sendAccessObservations(config, observations.slice(i, i + 50), transport)) ok = false;
  }
  return ok;
}

export async function readAccessMember(guild: Guild, discordId: string): Promise<AccessObservation> {
  const observedAt = new Date().toISOString();
  try {
    const member = await guild.members.fetch({ user: discordId, force: true });
    return observeAccess(member, "OAUTH", observedAt);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 10007) return { discordId, roleIds: [], observedAt, trigger: "OAUTH" };
    throw error;
  }
}
