import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type TextBasedChannel,
  type User,
} from "discord.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import type { TwitchAnnouncementConfig, TwitchConfig } from "../types/family.js";
import { logInfo, logWarning } from "../utils/logger.js";

const TWITCH_API = "https://api.twitch.tv/helix";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const POLL_INTERVAL_MS = 60_000;
const TWITCH_LOGIN = /^[a-z0-9][a-z0-9_]{2,24}$/;
type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type TwitchUser = { id: string; login: string; profile_image_url?: string };
export type TwitchStream = { game_name?: string; id: string; started_at?: string; thumbnail_url?: string; title?: string; user_id: string; user_login: string; viewer_count?: number };
type StreamState = { announcedStreamId: string | null; currentStreamId: string | null; isLive: boolean; lastSeenOfflineAt: string | null; lastSeenOnlineAt: string | null; startedAt: string | null; twitchUserId: string | null };
export type TwitchProfile = { discordUserId: string; state: StreamState | null; twitchLogin: string; twitchUserId: string | null };

export function normalizeTwitchLogin(value: string): string | null {
  let candidate = value.trim().toLowerCase();
  if (!candidate) return null;
  if (candidate.startsWith("@")) candidate = candidate.slice(1);
  if (candidate.includes("/")) {
    try {
      const url = new URL(/^https?:\/\//.test(candidate) ? candidate : `https://${candidate}`);
      if (url.hostname !== "twitch.tv" && url.hostname !== "www.twitch.tv") return null;
      candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch { return null; }
  }
  return TWITCH_LOGIN.test(candidate) ? candidate : null;
}

export class TwitchApi {
  #token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: TwitchConfig, private readonly fetchImplementation: FetchImplementation = globalThis.fetch) {}

  async userByLogin(login: string): Promise<TwitchUser | null> {
    return (await this.usersByLogins([login])).get(login) ?? null;
  }

  async usersByLogins(logins: string[]): Promise<Map<string, TwitchUser>> {
    const data = await this.request<TwitchUser[]>("/users", logins, "login");
    return new Map(data.map((user) => [user.login.toLowerCase(), user]));
  }

  async streamsByLogins(logins: string[]): Promise<Map<string, TwitchStream>> {
    const data = await this.request<TwitchStream[]>("/streams", logins, "user_login");
    return new Map(data.map((stream) => [stream.user_login.toLowerCase(), stream]));
  }

  private async request<T>(path: string, values: string[], parameter: "login" | "user_login", retried = false): Promise<T> {
    const token = await this.token();
    const query = new URLSearchParams(); values.forEach((value) => query.append(parameter, value));
    const response = await this.fetchImplementation(`${TWITCH_API}${path}?${query}`, { headers: { Authorization: `Bearer ${token}`, "Client-ID": this.config.clientId } });
    if (response.status === 401 && !retried) { this.#token = null; return this.request<T>(path, values, parameter, true); }
    if (!response.ok) throw new Error(`TwitchApiHttp${response.status}`);
    const body = await response.json() as { data?: T };
    return body.data ?? ([] as T);
  }

  private async token(): Promise<string> {
    if (this.#token && this.#token.expiresAt > Date.now() + 30_000) return this.#token.value;
    const body = new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, grant_type: "client_credentials" });
    const response = await this.fetchImplementation(TWITCH_TOKEN_URL, { body, headers: { "content-type": "application/x-www-form-urlencoded" }, method: "POST" });
    if (!response.ok) throw new Error(`TwitchTokenHttp${response.status}`);
    const result = await response.json() as { access_token?: string; expires_in?: number };
    const expiresIn = result.expires_in;
    if (!result.access_token || typeof expiresIn !== "number" || !Number.isFinite(expiresIn)) throw new Error("TwitchTokenInvalid");
    this.#token = { value: result.access_token, expiresAt: Date.now() + expiresIn * 1_000 };
    return result.access_token;
  }
}

export class TwitchSiteStore {
  constructor(private readonly config: SiteLogConfig, private readonly fetchImplementation: FetchImplementation = globalThis.fetch) {}

  async profiles(): Promise<TwitchProfile[]> {
    const response = await this.request("/api/internal/twitch/profiles");
    if (!response.ok) throw new Error(`TwitchStoreHttp${response.status}`);
    const body = await response.json() as { profiles?: TwitchProfile[] };
    return body.profiles ?? [];
  }

  async saveProfile(member: GuildMember, twitch: TwitchUser): Promise<boolean> {
    const response = await this.request("/api/internal/twitch/profiles", {
      body: JSON.stringify({ avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256 }), discordDisplayName: member.displayName, discordUserId: member.id, discordUsername: member.user.username, twitchLogin: twitch.login, twitchUserId: twitch.id }),
      headers: { "content-type": "application/json" }, method: "POST",
    });
    return response.ok;
  }

  async removeProfile(discordUserId: string): Promise<boolean> {
    return (await this.request(`/api/internal/twitch/profiles/${discordUserId}`, { method: "DELETE" })).ok;
  }

  async saveState(discordUserId: string, state: StreamState): Promise<void> {
    const response = await this.request("/api/internal/twitch/state", { body: JSON.stringify({ discordUserId, ...state, lastCheckedAt: new Date().toISOString() }), headers: { "content-type": "application/json" }, method: "POST" });
    if (!response.ok) throw new Error(`TwitchStateHttp${response.status}`);
  }

  private request(path: string, init: RequestInit = {}): Promise<Response> {
    return this.fetchImplementation(new URL(path, this.config.siteUrl), { ...init, cache: "no-store", headers: { ...init.headers, "x-londo-bot-secret": this.config.apiSecret } });
  }
}

function streamEmbed(stream: TwitchStream, user: TwitchUser | undefined, login: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(0x9146ff).setTitle("🔴 Стрим начался! ヽ(´▽`)/").setURL(`https://www.twitch.tv/${login}`).addFields(
    { name: "Тайтл", value: stream.title?.trim() || "Не указано", inline: false },
    { name: "Игра", value: stream.game_name?.trim() || "Не указана", inline: true },
    { name: "Зрители", value: String(Math.max(0, Math.trunc(stream.viewer_count ?? 0))), inline: true },
  ).setFooter({ text: `Twitch • ${login}` });
  if (user?.profile_image_url) embed.setThumbnail(user.profile_image_url);
  if (stream.thumbnail_url) embed.setImage(stream.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"));
  return embed;
}

export function createStreamAnnouncement(profile: TwitchProfile, stream: TwitchStream, user: TwitchUser | undefined, famMentionRoleId: string) {
  return {
    allowedMentions: { parse: [] as [], roles: [famMentionRoleId], users: [profile.discordUserId] },
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Смотреть стрим").setURL(`https://www.twitch.tv/${profile.twitchLogin}`))],
    content: `<@&${famMentionRoleId}> <@${profile.discordUserId}> начал(а) стрим!`,
    embeds: [streamEmbed(stream, user, profile.twitchLogin)],
  };
}

export class TwitchStreamWatcher {
  #timer: NodeJS.Timeout | null = null;
  #polling = false;
  readonly api: TwitchApi;
  readonly store: TwitchSiteStore;

  constructor(private readonly guild: Guild, private readonly config: TwitchConfig, siteConfig: SiteLogConfig, dependencies: { api?: TwitchApi; store?: TwitchSiteStore } = {}) {
    this.api = dependencies.api ?? new TwitchApi(config);
    this.store = dependencies.store ?? new TwitchSiteStore(siteConfig);
  }

  start(): void {
    logInfo("[TWITCH] Watcher initialized.");
    void this.poll();
    this.#timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    this.#timer.unref();
  }

  stop(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }

  async poll(): Promise<void> {
    if (this.#polling) return;
    this.#polling = true;
    try {
      const profiles = await this.store.profiles();
      logInfo(`[TWITCH] Tracking ${profiles.length} profiles.`);
      if (!profiles.length) return;
      const logins = profiles.map((profile) => profile.twitchLogin);
      const [streams, users] = await Promise.all([this.api.streamsByLogins(logins), this.api.usersByLogins(logins)]);
      for (const profile of profiles) await this.updateProfile(profile, streams.get(profile.twitchLogin), users.get(profile.twitchLogin));
    } catch (error) {
      logWarning(`[TWITCH] Poll failed: ${error instanceof Error ? error.name : "unknown error"}.`);
    } finally { this.#polling = false; }
  }

  async updateProfile(profile: TwitchProfile, stream: TwitchStream | undefined, user: TwitchUser | undefined): Promise<void> {
    const previous = profile.state;
    const now = new Date().toISOString();
    if (!stream) {
      if (previous?.isLive) logInfo(`[TWITCH] Stream offline: ${profile.discordUserId}.`);
      await this.store.saveState(profile.discordUserId, { announcedStreamId: previous?.announcedStreamId ?? null, currentStreamId: null, isLive: false, lastSeenOfflineAt: now, lastSeenOnlineAt: previous?.lastSeenOnlineAt ?? null, startedAt: previous?.startedAt ?? null, twitchUserId: user?.id ?? profile.twitchUserId });
      return;
    }
    logInfo(`[TWITCH] Stream online: ${profile.discordUserId} / ${stream.id}.`);
    const currentState: StreamState = { announcedStreamId: previous?.announcedStreamId ?? null, currentStreamId: stream.id, isLive: true, lastSeenOfflineAt: previous?.lastSeenOfflineAt ?? null, lastSeenOnlineAt: now, startedAt: stream.started_at ?? now, twitchUserId: user?.id ?? profile.twitchUserId };
    if (currentState.announcedStreamId !== stream.id && await this.announce(profile, stream, user)) {
      currentState.announcedStreamId = stream.id;
      logInfo(`[TWITCH] Announcement sent: ${stream.id}.`);
    }
    await this.store.saveState(profile.discordUserId, currentState);
  }

  private async announce(profile: TwitchProfile, stream: TwitchStream, user: TwitchUser | undefined): Promise<boolean> {
    const channel = await this.guild.channels.fetch(this.config.streamChannelId).catch(() => null);
    if (!channel?.isTextBased() || !channel.isSendable() || !("send" in channel)) { logWarning("[TWITCH] Stream channel unavailable."); return false; }
    await (channel as TextBasedChannel & { send(payload: ReturnType<typeof createStreamAnnouncement>): Promise<unknown> }).send(createStreamAnnouncement(profile, stream, user, this.config.famMentionRoleId));
    return true;
  }
}

export const twitchCommandDefinitions = [
  new SlashCommandBuilder().setName("twitch-add").setDescription("Добавить Twitch-канал участника").addUserOption((option) => option.setName("user").setDescription("Discord участник").setRequired(true)).addStringOption((option) => option.setName("login").setDescription("Twitch login или URL").setRequired(true)),
  new SlashCommandBuilder().setName("twitch-remove").setDescription("Удалить Twitch-канал участника").addUserOption((option) => option.setName("user").setDescription("Discord участник").setRequired(true)),
  new SlashCommandBuilder().setName("twitch-list").setDescription("Показать добавленные Twitch-каналы"),
  new SlashCommandBuilder().setName("test-stream").setDescription("Отправить тестовый анонс стрима"),
].map((command) => command.toJSON());

export async function sendTestStream(
  guild: Guild,
  user: User,
  config: TwitchAnnouncementConfig | null,
  profiles: () => Promise<TwitchProfile[]> = async () => [],
): Promise<"SENT" | "CHANNEL_MISSING" | "CHANNEL_UNAVAILABLE"> {
  if (!config) return "CHANNEL_MISSING";
  let twitchLogin = "test_streamer";
  try { twitchLogin = (await profiles()).find((profile) => profile.discordUserId === user.id)?.twitchLogin ?? twitchLogin; } catch { /* Profile lookup must not make the visual test fail. */ }
  const channel = await guild.channels.fetch(config.streamChannelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.isSendable() || !("send" in channel)) return "CHANNEL_UNAVAILABLE";
  const profile: TwitchProfile = { discordUserId: user.id, state: null, twitchLogin, twitchUserId: null };
  const testStream: TwitchStream = { game_name: "Grand Theft Auto V", id: "test-stream", title: "Тестовый стрим LONDO", user_id: "test", user_login: twitchLogin, viewer_count: 25 };
  await (channel as TextBasedChannel & { send(payload: ReturnType<typeof createStreamAnnouncement>): Promise<unknown> }).send(createStreamAnnouncement(profile, testStream, undefined, config.famMentionRoleId));
  return "SENT";
}

export async function handleTwitchCommand(
  interaction: ChatInputCommandInteraction,
  options: { announcementConfig: TwitchAnnouncementConfig | null; watcher: TwitchStreamWatcher | null },
): Promise<boolean> {
  if (!interaction.commandName.startsWith("twitch-") && interaction.commandName !== "test-stream") return false;
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: "Команда доступна только администраторам сервера.", ephemeral: true }); return true; }
  if (interaction.commandName === "test-stream") {
    const result = await sendTestStream(interaction.guild!, interaction.user, options.announcementConfig, options.watcher ? () => options.watcher!.store.profiles() : undefined);
    if (result === "CHANNEL_MISSING") await interaction.reply({ content: "TWITCH_STREAM_CHANNEL_ID не настроен.", ephemeral: true });
    else if (result === "CHANNEL_UNAVAILABLE") await interaction.reply({ content: "Канал стримов недоступен для бота.", ephemeral: true });
    else await interaction.reply({ content: `Тестовый анонс отправлен в <#${options.announcementConfig!.streamChannelId}>.`, ephemeral: true });
    return true;
  }
  const watcher = options.watcher;
  if (!watcher) { await interaction.reply({ content: "Twitch-интеграция не настроена.", ephemeral: true }); return true; }
  if (interaction.commandName === "twitch-list") {
    const profiles = await watcher.store.profiles();
    await interaction.reply({ content: profiles.length ? profiles.map((profile) => `<@${profile.discordUserId}> — ${profile.twitchLogin}`).join("\n") : "Список Twitch-каналов пуст.", ephemeral: true });
    return true;
  }
  const user = interaction.options.getUser("user", true);
  if (interaction.commandName === "twitch-remove") { await interaction.reply({ content: await watcher.store.removeProfile(user.id) ? "Twitch-канал удалён." : "Twitch-канал не найден.", ephemeral: true }); return true; }
  const login = normalizeTwitchLogin(interaction.options.getString("login", true));
  if (!login) { await interaction.reply({ content: "Укажите корректный Twitch login или URL.", ephemeral: true }); return true; }
  const twitch = await watcher.api.userByLogin(login);
  if (!twitch) { await interaction.reply({ content: "Twitch-канал не найден.", ephemeral: true }); return true; }
  const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
  if (!member) { await interaction.reply({ content: "Discord участник не найден на сервере.", ephemeral: true }); return true; }
  await interaction.reply({ content: await watcher.store.saveProfile(member, twitch) ? `Twitch-канал ${twitch.login} добавлен.` : "Не удалось сохранить Twitch-канал.", ephemeral: true });
  return true;
}
