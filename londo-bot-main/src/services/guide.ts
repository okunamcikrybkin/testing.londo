import {
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type ChatInputCommandInteraction,
  type Message,
  type MessageEditOptions,
  type TextChannel,
} from "discord.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { GuideConfig } from "../types/family.js";
import { logInfo, logWarning } from "../utils/logger.js";

const GUIDE_LOGO_PATH = fileURLToPath(new URL("../../assets/londo-guide-logo.png", import.meta.url));
const GUIDE_PROMO_PATH = fileURLToPath(new URL("../../assets/londo-promo.png", import.meta.url));
const GUIDE_TITLE = "Путеводитель по серверу LONDO";
const GUIDE_MARKER = "LONDO BOT";
const LONDO_DARK_RED = 0x5c1823;

type SendableChannel = TextChannel;
type GuideAssets = { logo: boolean; promo: boolean };
type GuidePanel = {
  components: [ContainerBuilder];
  embeds: [];
  files: AttachmentBuilder[];
  flags: MessageFlags.IsComponentsV2;
};

function safeReason(error: unknown): string {
  return error instanceof Error ? error.name : "unknown error";
}

function mention(channelId: string | null, text: string): string | null {
  return channelId ? `• <#${channelId}> — ${text}` : null;
}

function availableAssets(): GuideAssets {
  return { logo: existsSync(GUIDE_LOGO_PATH), promo: existsSync(GUIDE_PROMO_PATH) };
}

function createLinkSection(text: string, label: string, url: string | null): SectionBuilder {
  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(text),
  );

  if (url) {
    section.setButtonAccessory(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url),
    );
  }

  return section;
}

function addUsefulLink(container: ContainerBuilder, text: string, label: string, url: string | null): void {
  // Sections require an accessory in Discord Components V2. Preserve unavailable links as text.
  if (url) {
    container.addSectionComponents(createLinkSection(text, label, url));
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  }
}

/** Builds the guide as one Components V2 container, without embeds or top-level action rows. */
export function createGuidePanel(config: GuideConfig, assets: GuideAssets = availableAssets()): GuidePanel {
  const sections = [
    mention(config.channels.navigation, "Навигация сервера."),
    mention(config.channels.videos, "Трансляции и видео."),
    mention(config.channels.news, "Важные новости сервера."),
    mention(config.channels.guestChat, "Общий чат, гостевой."),
    mention(config.applicationChannelId, "Подать заявку в семью."),
    mention(config.channels.voiceGuest, "Гостевой voice."),
  ].filter((value): value is string => Boolean(value));

  const headerText = new TextDisplayBuilder().setContent(
    `# ${GUIDE_TITLE}\nБыстрая навигация по основным разделам`,
  );
  const container = new ContainerBuilder().setAccentColor(LONDO_DARK_RED);

  if (assets.logo) {
    const header = new SectionBuilder().addTextDisplayComponents(headerText);
    header.setThumbnailAccessory(
      new ThumbnailBuilder()
        .setURL("attachment://londo-guide-logo.png")
        .setDescription("LONDO"),
    );
    container.addSectionComponents(header);
  } else {
    container.addTextDisplayComponents(headerText);
  }

  container
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## Основные разделы\n${sections.length ? sections.join("\n") : "Разделы пока не настроены."}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Полезные ссылки"));

  addUsefulLink(container, "👋 Ждём тебя в нашей дружной фаме **LONDO**", "Подать заявку", config.urls.application);
  addUsefulLink(container, "〽️ Ссылка на регистрацию **/PROMO LONDO**", "Регистрация", config.urls.registration);
  addUsefulLink(container, "📘 Наша памятка по законодательной базе", "Памятка", config.urls.law);
  addUsefulLink(container, "✈️ Telegram-канал семьи LONDO", "Открыть Telegram", "https://t.me/londofam");

  if (assets.promo) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL("attachment://londo-promo.png")
          .setDescription("LONDO"),
      ),
    );
  }

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(GUIDE_MARKER));

  const files = [
    assets.logo ? new AttachmentBuilder(GUIDE_LOGO_PATH, { name: "londo-guide-logo.png" }) : null,
    assets.promo ? new AttachmentBuilder(GUIDE_PROMO_PATH, { name: "londo-promo.png" }) : null,
  ].filter((file): file is AttachmentBuilder => Boolean(file));

  return {
    components: [container],
    embeds: [],
    files,
    flags: MessageFlags.IsComponentsV2,
  };
}

function isV2GuideMessage(message: Message, botId: string): boolean {
  return message.author.id === botId
    && JSON.stringify(message.components).includes(GUIDE_TITLE)
    && JSON.stringify(message.components).includes(GUIDE_MARKER);
}

function isLegacyGuideMessage(message: Message, botId: string): boolean {
  return message.author.id === botId
    && message.embeds.some((embed) => embed.footer?.text === GUIDE_MARKER && embed.title === GUIDE_TITLE);
}

async function existingGuide(channel: SendableChannel, botId: string, messageId: string | null): Promise<Message | null> {
  if (messageId) {
    try {
      return await channel.messages.fetch(messageId);
    } catch {
      logWarning("[GUIDE] Guide message missing; creating a replacement.");
    }
  }

  const recent = await channel.messages.fetch({ limit: 100 });
  return recent.find((message) => isV2GuideMessage(message, botId) || isLegacyGuideMessage(message, botId)) ?? null;
}

async function updateGuideMessage(current: Message, channel: SendableChannel, panel: GuidePanel): Promise<void> {
  const editPanel: MessageEditOptions = {
    attachments: [],
    components: panel.components,
    embeds: panel.embeds,
    files: panel.files,
    flags: MessageFlags.IsComponentsV2,
  };

  try {
    await current.edit(editPanel);
  } catch (error) {
    if (!current.embeds.length) throw error;

    // Legacy embeds can reject the Components V2 flag during conversion. Replace only the marked guide.
    await current.delete();
    const replacement = await channel.send(panel);
    logInfo(`[GUIDE] Replaced legacy guide message: ${replacement.id}`);
  }
}

/** Creates or updates exactly one marked guide message in the configured channel. */
export async function publishGuide(
  interaction: ChatInputCommandInteraction,
  config: GuideConfig,
  assets: GuideAssets = availableAssets(),
): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "Команда доступна только администраторам сервера.", ephemeral: true });
    return;
  }

  if (!config.channelId) {
    logWarning("[GUIDE] Channel unavailable.");
    await interaction.reply({ content: "Guide-канал не настроен.", ephemeral: true });
    return;
  }

  try {
    const channel = await interaction.guild?.channels.fetch(config.channelId);
    if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("ChannelUnavailable");

    const guideChannel = channel as SendableChannel;
    const panel = createGuidePanel(config, assets);
    const current = await existingGuide(guideChannel, interaction.client.user?.id ?? "", config.messageId);

    if (current) {
      await updateGuideMessage(current, guideChannel, panel);
    } else {
      const created = await guideChannel.send(panel);
      logInfo(`[GUIDE] ${config.messageId ? "Guide message missing, recreated" : "Created guide message"}: ${created.id}`);
    }

    await interaction.reply({ content: "Guide-панель опубликована или обновлена.", ephemeral: true });
  } catch (error) {
    logWarning(`[GUIDE] Failed to publish guide: ${safeReason(error)}.`);
    await interaction.reply({ content: "Не удалось опубликовать guide-панель.", ephemeral: true });
  }
}
