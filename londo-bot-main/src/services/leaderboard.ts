import { EmbedBuilder, PermissionFlagsBits, type ChatInputCommandInteraction, type Guild, type Message, type TextBasedChannel } from "discord.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import type { LeaderboardConfig } from "../types/family.js";
import { logInfo, logWarning } from "../utils/logger.js";

const MARKER = "londo-leaderboard-v1";
const SCHEDULE_MS = 300_000;
const MIN_EDIT_MS = 60_000;
const LIMIT = 10;

export type LeaderboardEntry = { balance: string; discordUserId: string; totalVoiceSeconds: string };
export type LeaderboardData = { coins: LeaderboardEntry[]; generatedAt: string; voice: LeaderboardEntry[] };
type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

function endpointFor(siteUrl: string): string { return new URL("/api/internal/leaderboard", siteUrl).toString(); }

export function formatCoins(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const shortened = fraction.slice(0, 2).replace(/0+$/, "");
  return shortened ? `${whole}.${shortened}` : whole;
}

export function formatVoice(seconds: string): string {
  const minutes = Number(BigInt(seconds) / BigInt(60));
  return minutes < 60 ? `${minutes}м` : `${Math.floor(minutes / 60)}ч ${minutes % 60}м`;
}

function line(index: number, entry: LeaderboardEntry, type: "coins" | "voice"): string {
  const prefix = ["🥇", "🥈", "🥉"][index] ?? `${index + 1}.`;
  const value = type === "coins" ? `${formatCoins(entry.balance)} 🪙` : formatVoice(entry.totalVoiceSeconds);
  return `${prefix} <@${entry.discordUserId}> — ${value}`;
}

export function createLeaderboardEmbed(data: LeaderboardData, now = new Date()): EmbedBuilder {
  const coins = data.coins.slice(0, LIMIT);
  const voice = data.voice.slice(0, LIMIT);
  return new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle("Лидерборд Londo")
    .setDescription("Топ участников семьи по количеству коинов и времени в голосовых каналах.")
    .addFields(
      { name: "Топ-10 по коинам", value: coins.length ? coins.map((entry, index) => line(index, entry, "coins")).join("\n") : "Нет данных." },
      { name: "Топ-10 по голосовой активности", value: voice.length ? voice.map((entry, index) => line(index, entry, "voice")).join("\n") : "Нет данных." },
    )
    .setFooter({ text: MARKER })
    .setTimestamp(now);
}

export async function fetchLeaderboard(config: SiteLogConfig, fetchImplementation: FetchImplementation = globalThis.fetch): Promise<LeaderboardData | null> {
  try {
    const response = await fetchImplementation(endpointFor(config.siteUrl), { headers: { "x-londo-bot-secret": config.apiSecret }, method: "GET" });
    if (!response.ok) { logWarning(`[LEADERBOARD] Refresh failed: HTTP ${response.status}.`); return null; }
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !Array.isArray((data as { coins?: unknown }).coins) || !Array.isArray((data as { voice?: unknown }).voice)) { logWarning("[LEADERBOARD] Refresh failed: invalid response."); return null; }
    return data as LeaderboardData;
  } catch {
    logWarning("[LEADERBOARD] Refresh failed: network error.");
    return null;
  }
}

async function findExistingMessage(channel: TextBasedChannel, botId: string, configuredMessageId: string | null): Promise<Message | null> {
  if (configuredMessageId) {
    try { return await channel.messages.fetch(configuredMessageId); } catch { logWarning("[LEADERBOARD] Configured message was not found; creating a replacement."); }
  }
  const recent = await channel.messages.fetch({ limit: 100 });
  return recent.find((message) => message.author.id === botId && message.embeds.some((embed) => embed.footer?.text === MARKER)) ?? null;
}

export class LeaderboardManager {
  private lastEditAt = 0;
  private scheduled: NodeJS.Timeout | null = null;

  constructor(private readonly guild: Guild, private readonly config: LeaderboardConfig, private readonly site: SiteLogConfig, private readonly fetchImplementation: FetchImplementation = globalThis.fetch, private readonly scheduleMs = SCHEDULE_MS) {}

  async refresh(force = false): Promise<boolean> {
    if (!this.config.channelId) return false;
    if (!force && Date.now() - this.lastEditAt < MIN_EDIT_MS) return false;
    const data = await fetchLeaderboard(this.site, this.fetchImplementation);
    if (!data) return false;
    try {
      const channel = await this.guild.channels.fetch(this.config.channelId);
      if (!channel?.isTextBased() || !channel.isSendable()) { logWarning("[LEADERBOARD] Refresh failed: channel is unavailable or not sendable."); return false; }
      const existing = await findExistingMessage(channel, this.guild.client.user?.id ?? "", this.config.messageId);
      const embed = createLeaderboardEmbed(data);
      if (existing) await existing.edit({ embeds: [embed] });
      else { const created = await channel.send({ embeds: [embed] }); logInfo(`[LEADERBOARD] Created message: ${created.id}`); }
      this.lastEditAt = Date.now();
      return true;
    } catch {
      logWarning("[LEADERBOARD] Refresh failed: Discord message edit failed.");
      return false;
    }
  }

  start(): void {
    if (!this.config.channelId || this.scheduled) return;
    this.scheduled = setInterval(() => { void this.refresh(); }, this.scheduleMs);
    this.scheduled.unref();
  }

  stop(): void { if (this.scheduled) clearInterval(this.scheduled); this.scheduled = null; }
}

export async function setupLeaderboard(interaction: ChatInputCommandInteraction, manager: LeaderboardManager | null): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: "Команда доступна только администраторам сервера.", ephemeral: true }); return; }
  if (!manager) { await interaction.reply({ content: "Лидерборд не настроен: укажите LEADERBOARD_CHANNEL_ID.", ephemeral: true }); return; }
  const updated = await manager.refresh(true);
  await interaction.reply({ content: updated ? "Лидерборд создан или обновлён." : "Не удалось обновить лидерборд. Проверьте доступ к сайту и каналу.", ephemeral: true });
}
