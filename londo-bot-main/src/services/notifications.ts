import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits, type Guild, type Interaction } from "discord.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { logWarning } from "../utils/logger.js";

type Item = {
  eventId: string;
  family: "MEMPHIS" | "PHOENIX";
  channelId: string;
  roleId: string | null;
  title: string;
  path: string;
  userId: string;
  kindLabel?: string;
  participantName?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  mode?: "CREATE" | "UPDATE";
  messageId?: string;
  claim?: { reviewerName: string; reviewerId: string };
  resolution?: { status: string; reviewerName: string; reviewerId?: string | null; reason?: string | null; resolvedAt?: string | null };
};

export function notificationMessage(item: Item, siteUrl: string) {
  const url = new URL(item.path, siteUrl);
  const resolved = Boolean(item.resolution);
  const claimed = Boolean(item.claim);
  const claimUrl = item.kindLabel === "Заявка" ? `${url.href}${url.search ? "&" : "?"}claim=1` : url.href;
  if (!( ["MEMPHIS", "PHOENIX"] as string[]).includes(item.family) || !/^\d{17,20}$/.test(item.channelId) || (item.roleId && !/^\d{17,20}$/.test(item.roleId)) || !/^\d{17,20}$/.test(item.userId) || url.origin !== new URL(siteUrl).origin) throw Error("Invalid notification");
  const fields = (item.fields ?? []).slice(0, 18).map(field => ({ name: field.name.slice(0, 256), value: field.value.slice(0, 1024), inline: field.inline }));
  const rejected = item.resolution?.status === "REJECTED";
  const embed = new EmbedBuilder()
    .setColor(resolved ? (rejected ? 0xb85c65 : 0x75b98a) : 0xd4af37)
    .setTitle(resolved ? `${item.title} · Рассмотрено` : claimed ? `${item.title} · В работе` : item.title)
    .setDescription(resolved ? `Заявка рассмотрена. Решение: **${rejected ? "отклонена" : "одобрена"}**.` : claimed ? `Заявка закреплена за рекрутом и находится на рассмотрении.` : `${item.roleId ? `<@&${item.roleId}>\n\n` : ""}В поступившей заявке требуется рассмотрение рекрута.`)
    .addFields(
      { name: "Тип уведомления", value: item.kindLabel ?? "Заявка", inline: true },
      { name: "Сервер", value: item.family, inline: true },
      { name: "Участник", value: `<@${item.userId}>\n${item.participantName ?? "Участник"}` },
      ...fields,
      ...(claimed ? [{ name: "Рассматривает", value: `<@${item.claim?.reviewerId}>\n${item.claim?.reviewerName}`, inline: true }] : []),
      ...(resolved ? [
        { name: "Рассмотрел", value: `${item.resolution?.reviewerId ? `<@${item.resolution.reviewerId}>\n` : ""}${item.resolution?.reviewerName ?? "Рекрут не указан"}`, inline: true },
        { name: "Дата решения", value: item.resolution?.resolvedAt ? new Date(item.resolution.resolvedAt).toLocaleString("ru-RU") : "Не указана", inline: true },
        { name: rejected ? "Причина отклонения" : "Комментарий к решению", value: item.resolution?.reason ?? (rejected ? "Причина не указана." : "Одобрено без дополнительного комментария.") },
      ] : []),
    )
    .setFooter({ text: resolved ? "LONDO · Решение по заявке" : "LONDO · Уведомление для рекрутов" })
    .setTimestamp();
  return {
    content: resolved ? `${item.resolution?.reviewerId ? `<@${item.resolution.reviewerId}> · ` : ""}${item.family}` : claimed ? `<@${item.claim?.reviewerId}> · ${item.family}` : `${item.roleId ? `<@&${item.roleId}> · ` : ""}${item.family}`,
    embeds: [embed],
    components: resolved || claimed ? [] : [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Открыть заявку").setURL(claimUrl))],
    allowedMentions: { parse: [] as [], roles: resolved || claimed || !item.roleId ? [] : [item.roleId], users: resolved && item.resolution?.reviewerId ? [item.resolution.reviewerId] : claimed && item.claim?.reviewerId ? [item.claim.reviewerId] : [] },
    nonce: item.eventId.slice(0, 25),
    enforceNonce: true,
  };
}

export class ApplicationNotifications {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  constructor(private guild: Guild, private config: SiteLogConfig) {}
  async request<T>(body: object): Promise<T> {
    const response = await fetch(new URL("/api/internal/notifications", this.config.siteUrl), { method: "POST", headers: { "content-type": "application/json", "x-londo-bot-secret": this.config.apiSecret }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error("Notification API unavailable");
    return response.json() as Promise<T>;
  }
  async options() {
    await Promise.all([this.guild.channels.fetch(), this.guild.roles.fetch()]);
    const me = await this.guild.members.fetchMe();
    return {
      channels: this.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText && !!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory])).map(channel => ({ id: channel.id, name: channel.name })),
      roles: this.guild.roles.cache.filter(role => role.id !== this.guild.id && !role.managed && !role.tags?.botId && !role.tags?.integrationId && (role.mentionable || me.permissions.has(PermissionFlagsBits.MentionEveryone))).map(role => ({ id: role.id, name: role.name, position: role.position })),
    };
  }
  async handleInteraction(interaction: Interaction) {
    if (!interaction.isButton()) return false;
    const match = /^londo:notification:claim:([a-zA-Z0-9_-]{1,64})$/.exec(interaction.customId);
    if (!match) return false;
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await this.request<{ path: string; reviewer: string }>({ operation: "CLAIM", eventId: match[1], discordId: interaction.user.id });
      const url = new URL(result.path, this.config.siteUrl).href;
      if (interaction.message.editable) await interaction.message.edit({ content: `<@${interaction.user.id}> · заявка закреплена`, components: [], allowedMentions: { parse: [], roles: [], users: [interaction.user.id] } });
      await interaction.editReply({ content: `Заявка закреплена за вами, ${result.reviewer}.`, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Открыть заявку").setURL(url))] });
    } catch {
      await interaction.editReply({ content: "Не удалось взять заявку. Возможно, её уже забрал другой рекрут." });
    }
    return true;
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (const item of await this.request<Item[]>({ operation: "QUEUE" })) {
        try {
          const channel = await this.guild.channels.fetch(item.channelId);
          const me = await this.guild.members.fetchMe();
          if (channel?.type !== ChannelType.GuildText || !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory])) throw Error("Channel unavailable");
          if (!item.resolution && item.roleId) { const role = await this.guild.roles.fetch(item.roleId); if (!role || role.managed || role.tags?.botId || role.tags?.integrationId || (!role.mentionable && !channel.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone))) throw Error("Ping role unavailable"); }
          if (item.mode === "UPDATE") {
            if (!item.messageId || (!item.resolution && !item.claim)) throw Error("Notification update is incomplete");
            const message = await channel.messages.fetch(item.messageId);
            await message.edit(notificationMessage(item, this.config.siteUrl));
            await this.request(item.claim ? { operation: "CLAIM_RECEIPT", eventId: item.eventId, family: item.family, channelId: channel.id, messageId: message.id, state: item.claim.reviewerId } : { operation: "RESOLUTION_RECEIPT", eventId: item.eventId, family: item.family, channelId: channel.id, messageId: message.id, state: item.resolution?.status });
            continue;
          }
          const recent = await channel.messages.fetch({ limit: 100 });
          const nonce = item.eventId.slice(0, 25);
          const existing = recent.find(message => message.author.id === this.guild.client.user.id && message.nonce === nonce);
          const message = existing ?? await channel.send(notificationMessage(item, this.config.siteUrl));
          await this.request({ operation: "RECEIPT", eventId: item.eventId, family: item.family, channelId: channel.id, messageId: message.id });
        } catch { logWarning(`Notification delivery pending: ${item.family}, event ${item.eventId}.`); }
      }
    } catch { logWarning("Application notifications unavailable; will retry."); } finally { this.running = false; }
  }
  start() { if (this.timer) return; this.timer = setInterval(() => void this.tick(), 15000); this.timer.unref(); void this.tick(); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
