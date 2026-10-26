import type { SiteLogConfig } from "../config/siteLogs.js";
import { logWarning } from "../utils/logger.js";

const LOG_TIMEOUT_MS = 5_000;

export type SystemLogEvent = {
  actor?: { discordId: string; displayName: string; username: string };
  family?: "MEMPHIS" | "PHOENIX" | null;
  metadata: Record<string, string | number | boolean>;
  discordChannelId?: string;
  serverId: string;
  sourceEventId: string;
  summary: string;
  target?: { discordId: string; displayName: string; username: string };
  type?: "APPLICATION_CREATED" | "APPLICATION_CALL_STARTED" | "APPLICATION_ACCEPTED" | "APPLICATION_REJECTED" | "MEMBER_JOINED" | "MEMBER_LEFT" | "SYSTEM_EVENT";
  occurredAt?: string;
};

type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

function endpointFor(siteUrl: string): string {
  return new URL("/api/internal/logs", siteUrl).toString();
}

function safeFailureReason(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "timeout";
  }

  if (error instanceof Error) {
    return "network error";
  }

  return "unknown error";
}

/** Sends a single idempotent site event; delivery is never retried or fatal. */
export async function sendLogEvent(
  config: SiteLogConfig,
  event: SystemLogEvent,
  options: { fetchImplementation?: FetchImplementation; timeoutMs?: number } = {},
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? LOG_TIMEOUT_MS);
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;

  try {
    const response = await fetchImplementation(endpointFor(config.siteUrl), {
      body: JSON.stringify({
        sourceEventId: event.sourceEventId,
        type: event.type ?? "SYSTEM_EVENT",
        family: event.family ?? null,
        serverId: event.serverId,
        summary: event.summary,
        result: "SUCCESS",
        metadata: event.metadata,
        actor: event.actor,
        target: event.target,
        discordChannelId: event.discordChannelId,
        occurredAt: event.occurredAt ?? new Date().toISOString(),
      }),
      headers: { "content-type": "application/json", "x-londo-bot-secret": config.apiSecret },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      logWarning(`Site log delivery failed: HTTP ${response.status}.`);
      return false;
    }

    return true;
  } catch (error) {
    logWarning(`Site log delivery failed: ${safeFailureReason(error)}.`);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
