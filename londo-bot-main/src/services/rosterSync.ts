import type { Family } from "../types/family.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import type { RosterMember } from "./members.js";
import { logWarning } from "../utils/logger.js";

const ROSTER_TIMEOUT_MS = 8_000;

type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

function endpointFor(siteUrl: string): string {
  return new URL("/api/internal/roster", siteUrl).toString();
}

function rosterPayload(serverId: string, family: Family, members: RosterMember[]) {
  return {
    family,
    members: members.map((member) => ({
      avatarUrl: member.avatarUrl,
      discordDisplayName: member.discordDisplayName,
      discordUserId: member.discordUserId,
      discordUsername: member.discordUsername,
      gameNickname: member.gameNickname,
      rankDisplayName: member.rank?.label ?? null,
      rankKey: member.rank?.key ?? null,
      rankPriority: member.rank?.priority ?? null,
      rankRoleId: member.rank?.roleId ?? null,
      staticId: member.staticId,
    })),
    serverId,
  };
}

/** Delivers one family snapshot without retries; roster reads remain non-fatal to the bot. */
export async function syncFamilyRoster(
  config: SiteLogConfig,
  serverId: string,
  family: Family,
  members: RosterMember[],
  options: { fetchImplementation?: FetchImplementation; timeoutMs?: number } = {},
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? ROSTER_TIMEOUT_MS);

  try {
    const response = await (options.fetchImplementation ?? globalThis.fetch)(endpointFor(config.siteUrl), {
      body: JSON.stringify(rosterPayload(serverId, family, members)),
      headers: { "content-type": "application/json", "x-londo-bot-secret": config.apiSecret },
      method: "POST",
      signal: controller.signal,
    });
    if (!response.ok) {
      logWarning(`Roster sync failed for ${family}: HTTP ${response.status}.`);
      return false;
    }
    return true;
  } catch {
    logWarning(`Roster sync failed for ${family}: network error.`);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
