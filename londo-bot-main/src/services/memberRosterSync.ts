import type { SiteLogConfig } from "../config/siteLogs.js";
import type { FamilyRoleIds } from "../types/family.js";
import { getMemberRosterSync } from "./members.js";
import type { GuildMember } from "discord.js";
import { logWarning } from "../utils/logger.js";

const RETRY_DELAYS_MS = [0, 300, 900] as const;
const TIMEOUT_MS = 8_000;
type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;
type Delay = (milliseconds: number) => Promise<void>;

const wait: Delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function endpointFor(siteUrl: string): string {
  return new URL("/api/internal/roster/member-sync", siteUrl).toString();
}

/** Sends one coalesced member update with bounded retries; failures remain non-fatal. */
export async function syncRosterMember(
  config: SiteLogConfig,
  serverId: string,
  member: GuildMember,
  roles: FamilyRoleIds,
  options: { delay?: Delay; fetchImplementation?: FetchImplementation } = {},
): Promise<boolean> {
  const payload = { ...getMemberRosterSync(member, roles), serverId };
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const delay = options.delay ?? wait;

  for (const retryDelay of RETRY_DELAYS_MS) {
    if (retryDelay > 0) await delay(retryDelay);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImplementation(endpointFor(config.siteUrl), {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json", "x-londo-bot-secret": config.apiSecret },
        method: "POST",
        signal: controller.signal,
      });
      if (response.ok) return true;
    } catch {
      // The final warning below intentionally excludes payload and secret data.
    } finally {
      clearTimeout(timeout);
    }
  }

  logWarning(`[ROSTER] Member sync failed: Discord ID ${member.id}.`);
  return false;
}
