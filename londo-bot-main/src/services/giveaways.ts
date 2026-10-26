import { randomInt } from "node:crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, type Guild, type GuildMember, type Interaction, type TextBasedChannel } from "discord.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import type { FamilyRoleIds } from "../types/family.js";
import { getMemberFamilies } from "./members.js";
import { logWarning } from "../utils/logger.js";

const POLL_MS = 45_000;
const SNOWFLAKE = /^\d{17,20}$/;
export type GiveawayFamily = "MEMPHIS" | "PHOENIX" | "ALL";
export type GiveawayPayload = { id: string; family: GiveawayFamily; prize: string; description: string; imageUrl: string | null; discordChannelId: string; discordMessageId: string | null; requiredRoleId: string | null; mentionRoleId: string | null; winnerCount: number; endsAt: string; endedAt: string | null; createdAt: string; organizerDiscordId: string; participantCount: number; participants: Array<{ discordUserId: string }>; status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED"; winners: Array<{ discordUserId: string; position: number; isRerolled: boolean }> };
type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

function discordTimestamp(iso: string, format: "R" | "F"): string { return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:${format}>`; }
function mentionRole(giveaway: GiveawayPayload, roles: FamilyRoleIds): string | null {
  if (giveaway.mentionRoleId === "FAM") return roles.fam;
  return giveaway.mentionRoleId;
}
function currentWinners(giveaway: GiveawayPayload) { return giveaway.winners.filter((winner) => !winner.isRerolled).sort((a, b) => a.position - b.position); }

function accessLabel(giveaway: GiveawayPayload, roles: FamilyRoleIds): string {
  if (giveaway.requiredRoleId) return `<@&${giveaway.requiredRoleId}>`;
  if (giveaway.family === "MEMPHIS") return "Memphis";
  if (giveaway.family === "PHOENIX") return "Phoenix";
  return `<@&${roles.fam}>`;
}
function safeConditions(value: string): string { return value.replace(/@(everyone|here)/gi, "@\u200b$1"); }
function plainDate(iso: string): string { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso)); }
export function buildGiveawayMessage(giveaway: GiveawayPayload, roles: FamilyRoleIds) {
  const winners = currentWinners(giveaway);
  const status = giveaway.status;
  const statusText = status === "ACTIVE" ? `🟢 Активен • до конца ${discordTimestamp(giveaway.endsAt, "R")}` : status === "ENDED" ? "🔴 Завершён" : status === "CANCELLED" ? "⚫ Отменён" : "📝 Черновик";
  const closingAt = status === "ENDED" && giveaway.endedAt ? giveaway.endedAt : giveaway.endsAt;
  const info = [`Статус: ${statusText}`, `Победителей: ${giveaway.winnerCount}`, `Участников: ${giveaway.participantCount}`, `Доступ: ${accessLabel(giveaway, roles)}`, `Закрытие: ${discordTimestamp(closingAt, "F")}`, `Организатор: <@${giveaway.organizerDiscordId}>`].join("\n");
  const winnersBlock = status === "ENDED" ? `\n\n────────────\n**Победители**\n${winners.length ? winners.map((winner) => `• <@${winner.discordUserId}>`).join("\n") : "Победителей нет."}` : "";
  const embed = new EmbedBuilder()
    .setColor(status === "CANCELLED" ? 0x64748b : status === "ENDED" ? 0xe6b77a : 0x22c55e)
    .setTitle(`РОЗЫГРЫШ: ${giveaway.prize}`)
    .setDescription(`${info}\n\n────────────\n**Условия участия**\n${safeConditions(giveaway.description)}${winnersBlock}`)
    .setFooter({ text: `Создано ${plainDate(giveaway.createdAt)} • LONDO` });
  if (giveaway.imageUrl) embed.setImage(giveaway.imageUrl);
  const roleId = mentionRole(giveaway, roles);
  return {
    allowedMentions: { parse: [] as [], roles: status === "ACTIVE" && roleId ? [roleId] : [], users: status === "ENDED" ? winners.map((winner) => winner.discordUserId) : [] },
    components: status === "ACTIVE" ? [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`giveaway:join:${giveaway.id}`).setLabel("Участвовать").setStyle(ButtonStyle.Success))] : [],
    content: status === "ACTIVE" && roleId ? `<@&${roleId}>` : null,
    embeds: [embed],
  };
}

export class GiveawaySiteStore {
  constructor(private readonly config: SiteLogConfig, private readonly fetchImplementation: FetchImplementation = globalThis.fetch) {}
  async active(): Promise<GiveawayPayload[]> { const response = await this.request("/api/internal/giveaways/active"); if (!response.ok) throw new Error(`GiveawayStoreHttp${response.status}`); return ((await response.json()) as { giveaways?: GiveawayPayload[] }).giveaways ?? []; }
  async join(id: string, discordUserId: string): Promise<{ code: string; participantCount?: number }> { const response = await this.request(`/api/internal/giveaways/${id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ discordUserId }) }); const body = await response.json().catch(() => ({})) as { code?: string; participantCount?: unknown }; return { code: body.code ?? (response.ok ? "OK" : "INVALID_REQUEST"), ...(typeof body.participantCount === "number" ? { participantCount: body.participantCount } : {}) }; }
  async finish(id: string): Promise<{ finished: boolean; giveaway: GiveawayPayload }> { const response = await this.request(`/api/internal/giveaways/${id}/finish`, { method: "POST" }); if (!response.ok) throw new Error(`GiveawayFinishHttp${response.status}`); return await response.json() as { finished: boolean; giveaway: GiveawayPayload }; }
  private request(path: string, init: RequestInit = {}): Promise<Response> { return this.fetchImplementation(new URL(path, this.config.siteUrl), { ...init, cache: "no-store", headers: { ...init.headers, "x-londo-bot-secret": this.config.apiSecret } }); }
}

export class GiveawayManager {
  #timer: NodeJS.Timeout | null = null;
  #polling = false;
  readonly store: GiveawaySiteStore;
  constructor(private readonly guild: Guild, private readonly roles: FamilyRoleIds, siteConfig: SiteLogConfig, dependencies: { store?: GiveawaySiteStore } = {}) { this.store = dependencies.store ?? new GiveawaySiteStore(siteConfig); }
  start(): void { void this.poll(); this.#timer = setInterval(() => void this.poll(), POLL_MS); this.#timer.unref(); }
  stop(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }
  async publish(giveaway: GiveawayPayload): Promise<string> {
    if (!this.valid(giveaway)) throw new Error("INVALID_REQUEST");
    const channel = await this.guild.channels.fetch(giveaway.discordChannelId).catch(() => null);
    if (!channel?.isTextBased() || !channel.isSendable() || !("send" in channel)) throw new Error("CHANNEL_UNAVAILABLE");
    const me = this.guild.members.me;
    if (!me || !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory])) throw new Error("MISSING_PERMISSIONS");
    const message = await (channel as TextBasedChannel & { send(payload: ReturnType<typeof buildGiveawayMessage>): Promise<{ id: string }> }).send(buildGiveawayMessage(giveaway, this.roles));
    return message.id;
  }
  async refresh(giveaway: GiveawayPayload): Promise<void> { if (!giveaway.discordMessageId) return; const channel = await this.guild.channels.fetch(giveaway.discordChannelId).catch(() => null); if (!channel?.isTextBased() || !("messages" in channel)) return; const message = await channel.messages.fetch(giveaway.discordMessageId).catch(() => null); if (message) await message.edit(buildGiveawayMessage(giveaway, this.roles)); }
  async deleteMessage(giveaway: GiveawayPayload): Promise<void> { if (!giveaway.discordMessageId) return; const channel = await this.guild.channels.fetch(giveaway.discordChannelId).catch(() => null); if (!channel?.isTextBased() || !("messages" in channel)) return; const message = await channel.messages.fetch(giveaway.discordMessageId).catch(() => null); if (message) await message.delete(); }
  async handleInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isButton() || !interaction.customId.startsWith("giveaway:join:")) return false;
    const id = interaction.customId.slice("giveaway:join:".length);
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || !interaction.guild) { await interaction.reply({ content: "Розыгрыш недоступен.", ephemeral: true }); return true; }
    const giveaway = (await this.store.active()).find((entry) => entry.id === id);
    if (!giveaway || new Date(giveaway.endsAt) <= new Date()) { await interaction.reply({ content: "Этот розыгрыш уже завершён.", ephemeral: true }); return true; }
    const member = interaction.member as GuildMember | null;
    if (!member || !this.eligible(member, giveaway)) { await interaction.reply({ content: "Вы не соответствуете условиям этого розыгрыша.", ephemeral: true }); return true; }
    if (giveaway.requiredRoleId && !member.roles.cache.has(giveaway.requiredRoleId)) { await interaction.reply({ content: `Для участия требуется роль <@&${giveaway.requiredRoleId}>.`, allowedMentions: { parse: [] }, ephemeral: true }); return true; }
    const result = await this.store.join(id, interaction.user.id);
    if (result.code === "ALREADY_JOINED") await interaction.reply({ content: "Вы уже участвуете в этом розыгрыше.", ephemeral: true });
    else if (result.code === "OK") { await this.refresh({ ...giveaway, participantCount: result.participantCount ?? giveaway.participantCount }).catch(() => logWarning("[GIVEAWAY] Unable to refresh participant count.")); await interaction.reply({ content: "Вы участвуете в розыгрыше.", ephemeral: true }); }
    else await interaction.reply({ content: "Не удалось зарегистрировать участие.", ephemeral: true });
    return true;
  }
  async poll(): Promise<void> { if (this.#polling) return; this.#polling = true; try { for (const giveaway of await this.store.active()) { if (new Date(giveaway.endsAt) <= new Date()) { const result = await this.store.finish(giveaway.id); if (result.finished) await this.refresh(result.giveaway); } } } catch (error) { logWarning(`[GIVEAWAY] Poll failed: ${error instanceof Error ? error.name : "unknown error"}.`); } finally { this.#polling = false; } }
  private eligible(member: GuildMember, giveaway: GiveawayPayload): boolean { const families = getMemberFamilies(member, this.roles); return giveaway.family === "ALL" ? member.roles.cache.has(this.roles.fam) : families.includes(giveaway.family); }
  private valid(value: GiveawayPayload): boolean { return /^[a-zA-Z0-9_-]{1,64}$/.test(value.id) && ["MEMPHIS", "PHOENIX", "ALL"].includes(value.family) && SNOWFLAKE.test(value.discordChannelId) && SNOWFLAKE.test(value.organizerDiscordId) && typeof value.prize === "string" && typeof value.description === "string" && Number.isInteger(value.winnerCount) && value.winnerCount >= 1 && value.winnerCount <= 20; }
}

// Kept exported for deterministic test coverage of the crypto selection requirement.
export function selectGiveawayWinners(ids: string[], count: number): string[] { const pool = [...new Set(ids)]; const winners: string[] = []; while (pool.length && winners.length < count) winners.push(pool.splice(randomInt(pool.length), 1)[0]); return winners; }
