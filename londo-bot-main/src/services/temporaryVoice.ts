import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  OverwriteType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type ButtonInteraction,
  type Guild,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextChannel,
  type UserSelectMenuInteraction,
  type VoiceChannel,
  type VoiceState,
} from "discord.js";
import { logInfo, logWarning } from "../utils/logger.js";

export const TEMPORARY_VOICE_PANEL_CHANNEL_ID = "1545123267113918573";
export const TEMPORARY_VOICE_TRIGGER_CHANNEL_ID = "1545123267113918574";
export const TEMPORARY_VOICE_CATEGORY_ID = "1545123267113918572";
export const TEMPORARY_VOICE_DELETE_DELAY_MS = 60_000;

const PANEL_MARKER = "londo-temporary-voice-panel";
const COMPONENT_PREFIX = "londo:tempvoice:";
const CHANNEL_REASON = "Управление временной комнатой LONDO";

type RoomAction = "add" | "remove" | "kick" | "transfer";

class TemporaryVoiceError extends Error {}

export function temporaryVoiceOwnerId(channel: Pick<VoiceChannel, "permissionOverwrites">): string | null {
  return channel.permissionOverwrites.cache.find((overwrite) =>
    overwrite.type === OverwriteType.Member && overwrite.allow.has(PermissionFlagsBits.ManageChannels),
  )?.id ?? null;
}

export function createTemporaryVoicePanel() {
  const embed = new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle("🎙️ Временные голосовые комнаты LONDO")
    .setDescription([
      "Зайдите в канал **«Создать временный канал»** — бот откроет вашу личную комнату.",
      "Когда из комнаты выйдут все участники, она будет удалена через **1 минуту**.",
      "",
      "Кнопки ниже управляют комнатой, в которой вы сейчас находитесь. Настройки доступны владельцу комнаты и администраторам.",
    ].join("\n"))
    .addFields(
      { name: "Доступ", value: "Публичный или приватный, блокировка входа и приглашение участников.", inline: true },
      { name: "Управление", value: "Название, лимит, регион, чат и передача владения.", inline: true },
    )
    .setFooter({ text: PANEL_MARKER });

  const button = (action: string, label: string, style = ButtonStyle.Secondary, emoji?: string) => {
    const component = new ButtonBuilder().setCustomId(`${COMPONENT_PREFIX}${action}`).setLabel(label).setStyle(style);
    if (emoji) component.setEmoji(emoji);
    return component;
  };

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button("rename", "Название", ButtonStyle.Secondary, "✏️"),
        button("limit", "Лимит", ButtonStyle.Secondary, "👥"),
        button("privacy", "Приватность", ButtonStyle.Secondary, "🔒"),
        button("block", "Вход", ButtonStyle.Secondary, "🚪"),
        button("chat", "Чат", ButtonStyle.Secondary, "💬"),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button("add", "Добавить", ButtonStyle.Secondary, "➕"),
        button("remove", "Убрать доступ", ButtonStyle.Secondary, "➖"),
        button("kick", "Выгнать", ButtonStyle.Secondary, "👢"),
        button("invite", "Пригласить", ButtonStyle.Secondary, "🔗"),
        button("region", "Регион", ButtonStyle.Secondary, "🌐"),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button("waiting", "Ожидание", ButtonStyle.Secondary, "🤫"),
        button("owner", "Владелец", ButtonStyle.Secondary, "👑"),
        button("transfer", "Передать", ButtonStyle.Secondary, "🔁"),
        button("delete", "Удалить комнату", ButtonStyle.Danger, "🗑️"),
      ),
    ],
    allowedMentions: { parse: [] as [] },
  };
}

export class TemporaryVoiceManager {
  private readonly deletionTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingOwners = new Set<string>();

  constructor(private readonly guild: Guild) {}

  async start(): Promise<void> {
    const [trigger, category, panel] = await Promise.all([
      this.guild.channels.fetch(TEMPORARY_VOICE_TRIGGER_CHANNEL_ID),
      this.guild.channels.fetch(TEMPORARY_VOICE_CATEGORY_ID),
      this.guild.channels.fetch(TEMPORARY_VOICE_PANEL_CHANNEL_ID),
      this.guild.channels.fetch(),
    ]);

    if (!trigger || trigger.type !== ChannelType.GuildVoice) throw new Error("Канал создания временных комнат недоступен.");
    if (!category || category.type !== ChannelType.GuildCategory) throw new Error("Категория временных комнат недоступна.");
    if (!panel || panel.type !== ChannelType.GuildText) throw new Error("Текстовый канал панели временных комнат недоступен.");

    const botMember = await this.guild.members.fetchMe();
    if (!botMember.permissions.has([
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.CreateInstantInvite,
    ])) {
      throw new Error("Боту нужны права Manage Channels, Move Members и Create Instant Invite для временных комнат.");
    }
    if (!category.permissionsFor(botMember)?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.CreateInstantInvite,
    ]) || !trigger.permissionsFor(botMember)?.has(PermissionFlagsBits.MoveMembers)) {
      throw new Error("Проверьте права бота на просмотр, подключение, приглашения и управление каналами в категории, а также перемещение участников из канала создания.");
    }
    if (!panel.permissionsFor(botMember)?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
    ])) {
      throw new Error("Боту нужны права просмотра, отправки сообщений, встраивания ссылок и чтения истории в канале панели.");
    }

    await this.ensurePanel(panel);
    for (const channel of this.guild.channels.cache.values()) {
      if (this.isManagedRoom(channel) && channel.members.size === 0) this.scheduleDeletion(channel.id);
    }
    for (const member of trigger.members.values()) {
      try {
        await this.createOrMoveMember(member.id);
      } catch (error) {
        logWarning(`[TEMP VOICE] Unable to create a room for ${member.id}: ${error instanceof Error ? error.name : "unknown error"}.`);
      }
    }
    logInfo("[TEMP VOICE] Temporary voice manager initialized.");
  }

  stop(): void {
    for (const timer of this.deletionTimers.values()) clearTimeout(timer);
    this.deletionTimers.clear();
  }

  async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (oldState.guild.id !== this.guild.id || newState.guild.id !== this.guild.id) return;
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const oldChannel = await this.guild.channels.fetch(oldState.channelId);
      if (oldChannel?.type === ChannelType.GuildVoice && this.isManagedRoom(oldChannel)) this.scheduleDeletion(oldChannel.id);
    }
    if (newState.channelId) {
      const newChannel = await this.guild.channels.fetch(newState.channelId);
      if (newChannel?.type === ChannelType.GuildVoice && this.isManagedRoom(newChannel)) this.cancelDeletion(newChannel.id);
    }
    if (newState.channelId === TEMPORARY_VOICE_TRIGGER_CHANNEL_ID && oldState.channelId !== newState.channelId) {
      await this.createOrMoveMember(newState.id);
    }
  }

  async handleInteraction(interaction: Interaction): Promise<boolean> {
    const customId = "customId" in interaction ? interaction.customId : "";
    if (!customId.startsWith(COMPONENT_PREFIX)) return false;
    if (!interaction.guild || interaction.guild.id !== this.guild.id) return true;

    try {
      if (interaction.isButton()) {
        await this.handleButton(interaction);
      } else if (interaction.isUserSelectMenu()) {
        await this.handleUserSelection(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await this.handleStringSelection(interaction);
      } else if (interaction.isModalSubmit()) {
        await this.handleModal(interaction);
      } else {
        return false;
      }
    } catch (error) {
      logWarning(`[TEMP VOICE] Interaction failed: ${error instanceof Error ? error.name : "unknown error"}.`);
      const content = error instanceof TemporaryVoiceError ? error.message : "Не удалось выполнить действие. Проверьте права бота и попробуйте ещё раз.";
      if (interaction.isRepliable()) {
        if (interaction.deferred) await interaction.editReply({ content });
        else if (interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
        else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
    return true;
  }

  private isManagedRoom(channel: unknown): channel is VoiceChannel {
    if (!channel || typeof channel !== "object" || !("type" in channel) || !("parentId" in channel)) return false;
    const voice = channel as VoiceChannel;
    return voice.type === ChannelType.GuildVoice
      && voice.parentId === TEMPORARY_VOICE_CATEGORY_ID
      && temporaryVoiceOwnerId(voice) !== null;
  }

  private async ensurePanel(channel: TextChannel): Promise<void> {
    let before: string | undefined;
    let panelMessage: Awaited<ReturnType<TextChannel["send"]>> | null = null;
    const duplicates: Awaited<ReturnType<TextChannel["send"]>>[] = [];

    for (;;) {
      const recent = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      for (const message of recent.values()) {
        if (message.author.id !== this.guild.client.user.id || !message.embeds.some((embed) => embed.footer?.text === PANEL_MARKER)) continue;
        if (panelMessage) duplicates.push(message);
        else panelMessage = message;
      }
      if (recent.size < 100) break;
      before = recent.last()?.id;
      if (!before) break;
    }

    const content = createTemporaryVoicePanel();
    if (panelMessage) await panelMessage.edit(content);
    else await channel.send(content);
    for (const duplicate of duplicates) await duplicate.delete();
  }

  private async createOrMoveMember(userId: string): Promise<void> {
    if (this.pendingOwners.has(userId)) return;
    this.pendingOwners.add(userId);
    try {
      const member = await this.guild.members.fetch(userId);
      const existing = this.guild.channels.cache.find((channel) =>
        this.isManagedRoom(channel) && temporaryVoiceOwnerId(channel) === userId,
      );
      if (existing && this.isManagedRoom(existing)) {
        this.cancelDeletion(existing.id);
        await member.voice.setChannel(existing, CHANNEL_REASON);
        return;
      }

      const room = await this.guild.channels.create({
        name: roomName(member.displayName),
        type: ChannelType.GuildVoice,
        parent: TEMPORARY_VOICE_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: this.guild.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.SendMessages,
            ],
          },
          {
            id: this.guild.client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.SendMessages,
            ],
          },
        ],
        reason: "Создана личная временная голосовая комната",
      });
      await member.voice.setChannel(room, CHANNEL_REASON);
    } finally {
      this.pendingOwners.delete(userId);
    }
  }

  private async getAuthorizedRoom(interaction: Interaction, roomId?: string): Promise<{ room: VoiceChannel; ownerId: string }> {
    const guild = interaction.guild;
    if (!guild || guild.id !== this.guild.id) throw new TemporaryVoiceError("Это действие доступно только на сервере LONDO.");
    const member = await guild.members.fetch(interaction.user.id);
    const targetId = roomId ?? member.voice.channelId;
    if (!targetId) throw new TemporaryVoiceError("Сначала зайдите в свою временную комнату.");
    const channel = await guild.channels.fetch(targetId);
    if (!this.isManagedRoom(channel)) throw new TemporaryVoiceError("Вы должны находиться во временной комнате LONDO.");

    const ownerId = temporaryVoiceOwnerId(channel);
    if (!ownerId) throw new TemporaryVoiceError("Не удалось определить владельца комнаты.");
    if (member.id !== ownerId && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      throw new TemporaryVoiceError("Управлять комнатой может только её владелец или администратор.");
    }
    return { room: channel, ownerId };
  }

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const action = interaction.customId.slice(COMPONENT_PREFIX.length);
    const { room, ownerId } = await this.getAuthorizedRoom(interaction);
    if (action === "rename" || action === "limit") {
      await interaction.showModal(this.createModal(action, room));
      return;
    }
    if (action === "add" || action === "remove" || action === "kick" || action === "transfer") {
      const labels: Record<RoomAction, string> = {
        add: "Кого добавить в комнату?",
        remove: "У кого убрать доступ?",
        kick: "Кого выгнать из комнаты?",
        transfer: "Кому передать владение?",
      };
      await interaction.reply({
        content: labels[action],
        components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(`${COMPONENT_PREFIX}select:${action}:${room.id}`)
            .setPlaceholder("Выберите участника")
            .setMinValues(1)
            .setMaxValues(1),
        )],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (action === "region") {
      const regions = await interaction.client.fetchVoiceRegions();
      const options = [
        { label: "Автоматически", value: "auto", default: room.rtcRegion === null },
        ...[...regions.values()]
          .filter((region) => !region.deprecated || region.id === room.rtcRegion)
          .slice(0, 24)
          .map((region) => ({
            label: region.name.slice(0, 100),
            value: region.id,
            default: region.id === room.rtcRegion,
          })),
      ];
      await interaction.reply({
        content: `Выберите регион для комнаты <#${room.id}>:`,
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${COMPONENT_PREFIX}select:region:${room.id}`)
            .setPlaceholder("Регион сервера")
            .addOptions(options),
        )],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (action === "owner") {
      await interaction.reply({ content: `Владелец этой комнаты: <@${ownerId}>.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (action === "privacy") {
      const everyone = room.permissionOverwrites.cache.get(this.guild.id);
      await room.permissionOverwrites.edit(this.guild.id, {
        ViewChannel: everyone?.deny.has(PermissionFlagsBits.ViewChannel) ? true : false,
      }, { reason: CHANNEL_REASON });
      const isPrivate = room.permissionOverwrites.cache.get(this.guild.id)?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;
      await interaction.editReply(isPrivate ? "Комната теперь приватная." : "Комната теперь видна всем.");
    } else if (action === "block") {
      const everyone = room.permissionOverwrites.cache.get(this.guild.id);
      await room.permissionOverwrites.edit(this.guild.id, {
        Connect: everyone?.deny.has(PermissionFlagsBits.Connect) ? true : false,
      }, { reason: CHANNEL_REASON });
      const isBlocked = room.permissionOverwrites.cache.get(this.guild.id)?.deny.has(PermissionFlagsBits.Connect) ?? false;
      await interaction.editReply(isBlocked ? "Вход в комнату закрыт." : "Вход в комнату открыт.");
    } else if (action === "chat") {
      const everyone = room.permissionOverwrites.cache.get(this.guild.id);
      await room.permissionOverwrites.edit(this.guild.id, {
        SendMessages: everyone?.deny.has(PermissionFlagsBits.SendMessages) ? true : false,
      }, { reason: CHANNEL_REASON });
      const isDisabled = room.permissionOverwrites.cache.get(this.guild.id)?.deny.has(PermissionFlagsBits.SendMessages) ?? false;
      await interaction.editReply(isDisabled ? "Чат комнаты отключён." : "Чат комнаты включён.");
    } else if (action === "waiting") {
      const everyone = room.permissionOverwrites.cache.get(this.guild.id);
      await room.permissionOverwrites.edit(this.guild.id, {
        Speak: everyone?.deny.has(PermissionFlagsBits.Speak) ? true : false,
      }, { reason: CHANNEL_REASON });
      const isMuted = room.permissionOverwrites.cache.get(this.guild.id)?.deny.has(PermissionFlagsBits.Speak) ?? false;
      await interaction.editReply(isMuted ? "Режим ожидания включён: участники не могут говорить." : "Режим ожидания выключен.");
    } else if (action === "invite") {
      const invite = await room.createInvite({ maxAge: 3600, maxUses: 1, unique: true, reason: CHANNEL_REASON });
      await interaction.editReply({
        content: `Одноразовое приглашение в комнату <#${room.id}> (действует 1 час):`,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Присоединиться").setURL(invite.url),
        )],
      });
    } else if (action === "delete") {
      this.cancelDeletion(room.id);
      await room.delete("Комната удалена владельцем или администратором");
      await interaction.editReply("Временная комната удалена.");
    } else {
      throw new TemporaryVoiceError("Неизвестное действие панели.");
    }
  }

  private async handleUserSelection(interaction: UserSelectMenuInteraction): Promise<void> {
    const match = interaction.customId.match(/^londo:tempvoice:select:(add|remove|kick|transfer):(\d+)$/);
    if (!match) throw new TemporaryVoiceError("Неизвестное действие панели.");
    const action = match[1] as RoomAction;
    const { room, ownerId } = await this.getAuthorizedRoom(interaction, match[2]);
    const targetId = interaction.values[0];
    if (!targetId) throw new TemporaryVoiceError("Выберите участника.");
    if (action === "transfer" && !room.members.has(targetId)) {
      throw new TemporaryVoiceError("Передать владение можно только участнику, который находится в комнате.");
    }
    if (action === "transfer" && targetId === ownerId) {
      throw new TemporaryVoiceError("Этот участник уже владелец комнаты.");
    }
    if (action === "kick" && targetId === ownerId) {
      throw new TemporaryVoiceError("Нельзя выгнать владельца комнаты.");
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (action === "add") {
      await room.permissionOverwrites.edit(targetId, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        SendMessages: true,
      }, { reason: CHANNEL_REASON });
      await interaction.editReply(`<@${targetId}> получил доступ к комнате.`);
    } else if (action === "remove") {
      await room.permissionOverwrites.edit(targetId, { ViewChannel: false, Connect: false }, { reason: CHANNEL_REASON });
      await interaction.editReply(`Доступ <@${targetId}> к комнате закрыт.`);
    } else if (action === "kick") {
      const member = await this.guild.members.fetch(targetId);
      if (!room.members.has(targetId)) throw new TemporaryVoiceError("Этот участник больше не находится в комнате.");
      await room.permissionOverwrites.edit(targetId, { ViewChannel: false, Connect: false }, { reason: CHANNEL_REASON });
      await member.voice.disconnect(CHANNEL_REASON);
      await interaction.editReply(`<@${targetId}> удалён из комнаты и больше не может в неё войти.`);
    } else {
      await room.permissionOverwrites.edit(ownerId, { ManageChannels: false }, { reason: CHANNEL_REASON });
      await room.permissionOverwrites.edit(targetId, {
        ManageChannels: true,
        ViewChannel: true,
        Connect: true,
        Speak: true,
        SendMessages: true,
      }, { reason: CHANNEL_REASON });
      await interaction.editReply(`Владение комнатой передано участнику <@${targetId}>.`);
    }
  }

  private async handleStringSelection(interaction: StringSelectMenuInteraction): Promise<void> {
    const match = interaction.customId.match(/^londo:tempvoice:select:region:(\d+)$/);
    if (!match) throw new TemporaryVoiceError("Неизвестное действие панели.");
    const { room } = await this.getAuthorizedRoom(interaction, match[1]);
    const region = interaction.values[0];
    if (!region) throw new TemporaryVoiceError("Выберите регион.");
    if (region !== "auto") {
      const regions = await interaction.client.fetchVoiceRegions();
      if (!regions.has(region)) throw new TemporaryVoiceError("Выбранный регион больше недоступен.");
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await room.setRTCRegion(region === "auto" ? null : region, CHANNEL_REASON);
    await interaction.editReply(region === "auto" ? "Регион комнаты установлен автоматически." : `Регион комнаты изменён на **${region}**.`);
  }

  private async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const match = interaction.customId.match(/^londo:tempvoice:modal:(rename|limit):(\d+)$/);
    if (!match) throw new TemporaryVoiceError("Неизвестное действие панели.");
    const { room } = await this.getAuthorizedRoom(interaction, match[2]);
    const value = interaction.fields.getTextInputValue("value");
    if (match[1] === "rename") {
      const name = roomName(value);
      if (!name) throw new TemporaryVoiceError("Название комнаты не может быть пустым.");
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await room.setName(name, CHANNEL_REASON);
      await interaction.editReply(`Название комнаты изменено на **${name}**.`);
    } else {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
        throw new TemporaryVoiceError("Укажите целое число от 0 до 99. Значение 0 снимает лимит.");
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await room.setUserLimit(limit, CHANNEL_REASON);
      await interaction.editReply(limit === 0 ? "Лимит участников снят." : `Лимит комнаты: **${limit}**.`);
    }
  }

  private createModal(action: "rename" | "limit", room: VoiceChannel): ModalBuilder {
    if (action === "rename") {
      return new ModalBuilder()
        .setCustomId(`${COMPONENT_PREFIX}modal:rename:${room.id}`)
        .setTitle("Название комнаты")
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("value")
            .setLabel("Новое название")
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(100)
            .setPlaceholder(room.name.slice(0, 100))
            .setRequired(true),
        ));
    }
    return new ModalBuilder()
      .setCustomId(`${COMPONENT_PREFIX}modal:limit:${room.id}`)
      .setTitle("Лимит участников")
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("value")
          .setLabel("Число участников (0–99, 0 — без лимита)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2)
          .setPlaceholder(String(room.userLimit))
          .setRequired(true),
      ));
  }

  private scheduleDeletion(channelId: string): void {
    this.cancelDeletion(channelId);
    const timer = setTimeout(() => {
      this.deletionTimers.delete(channelId);
      void this.deleteIfEmpty(channelId).catch((error: unknown) => {
        logWarning(`[TEMP VOICE] Unable to delete empty room: ${error instanceof Error ? error.name : "unknown error"}.`);
      });
    }, TEMPORARY_VOICE_DELETE_DELAY_MS);
    timer.unref();
    this.deletionTimers.set(channelId, timer);
  }

  private cancelDeletion(channelId: string): void {
    const timer = this.deletionTimers.get(channelId);
    if (timer) clearTimeout(timer);
    this.deletionTimers.delete(channelId);
  }

  private async deleteIfEmpty(channelId: string): Promise<void> {
    const channel = await this.guild.channels.fetch(channelId);
    if (!this.isManagedRoom(channel) || channel.members.size !== 0) return;
    await channel.delete("Временная комната пуста более одной минуты");
    logInfo(`[TEMP VOICE] Empty room ${channelId} deleted.`);
  }
}

function roomName(value: string): string {
  return value.trim().replace(/\s+/g, "-").slice(0, 100);
}
