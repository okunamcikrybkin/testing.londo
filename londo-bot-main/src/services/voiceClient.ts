import type { SiteLogConfig } from "../config/siteLogs.js";

type Operation = { operation: "RECONCILE"; activeDiscordUserIds: string[] } | { operation: "START"; discordUserId: string } | { operation: "SETTLE"; discordUserId: string; keepActive: boolean };

export async function sendVoiceOperation(config: SiteLogConfig, operation: Operation): Promise<boolean> {
  try {
    const response = await fetch(new URL("/api/internal/voice", config.siteUrl), { method: "POST", headers: { "content-type": "application/json", "x-londo-bot-secret": config.apiSecret }, body: JSON.stringify(operation) });
    return response.ok;
  } catch { return false; }
}
