import { AttachmentBuilder, EmbedBuilder, PermissionFlagsBits, type ChatInputCommandInteraction, type Guild, type GuildMember, type PartialGuildMember } from "discord.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { WelcomeConfig } from "../types/family.js";
import { logInfo, logWarning } from "../utils/logger.js";

const WELCOME_IMAGE_PATH = fileURLToPath(new URL("../../assets/londo-guide-logo.png", import.meta.url));
const WELCOME_IMAGE_NAME = "londo-guide-logo.png";

type SendableChannel = { isSendable(): boolean; isTextBased(): boolean; send(payload: unknown): Promise<unknown> };
type NoticeMember = GuildMember | PartialGuildMember;

function safeReason(error: unknown): string { return error instanceof Error ? error.name : "unknown error"; }

export function createWelcomeMessage(member: Pick<GuildMember, "displayName" | "id" | "user">, memberCount: number, applicationChannelId: string | null, includeImage = existsSync(WELCOME_IMAGE_PATH)) {
  const applicationText = applicationChannelId ? `Подавай заявку <#${applicationChannelId}>` : "Подавай заявку в разделе заявок";
  const timestamp = Math.floor(Date.now() / 1_000);
  const embed = new EmbedBuilder()
    .setColor(0x5c1823)
    .setDescription(`<@${member.id}>\n\n**${member.displayName || member.user.username}**\nприсоединился к серверу LONDO\n\n${applicationText}\n\n────────────\nВсего участников — ${memberCount} • <t:${timestamp}:t>`);
  if (includeImage) embed.setImage(`attachment://${WELCOME_IMAGE_NAME}`);
  return { embeds: [embed], files: includeImage ? [new AttachmentBuilder(WELCOME_IMAGE_PATH, { name: WELCOME_IMAGE_NAME })] : [] };
}

export function createLeaveMessage(member: Pick<GuildMember, "displayName" | "id" | "user">, memberCount: number, includeImage = existsSync(WELCOME_IMAGE_PATH)) {
  const timestamp = Math.floor(Date.now() / 1_000);
  const embed = new EmbedBuilder()
    .setColor(0x5c1823)
    .setDescription(`<@${member.id}>\n\n**${member.displayName || member.user.username}**\nпокинул сервер LONDO\n\n────────────\nВсего участников — ${memberCount} • <t:${timestamp}:t>`);
  if (includeImage) embed.setImage(`attachment://${WELCOME_IMAGE_NAME}`);
  return { embeds: [embed], files: includeImage ? [new AttachmentBuilder(WELCOME_IMAGE_PATH, { name: WELCOME_IMAGE_NAME })] : [] };
}

async function sendMemberNotice(
  member: NoticeMember,
  config: WelcomeConfig,
  type: "join" | "leave",
  options: { assetExists?: boolean; channel?: SendableChannel | null } = {},
): Promise<boolean> {
  if (member.user.bot) return false;
  if (!config.channelId) { logWarning("[WELCOME] Channel unavailable."); return false; }
  try {
    const fetched = options.channel === undefined ? await member.guild.channels.fetch(config.channelId) : options.channel;
    if (!fetched?.isTextBased() || !fetched.isSendable()) { logWarning("[WELCOME] Channel unavailable."); return false; }
    const payload = type === "join"
      ? createWelcomeMessage(member, member.guild.memberCount, config.applicationChannelId, options.assetExists)
      : createLeaveMessage(member, member.guild.memberCount, options.assetExists);
    await (fetched as SendableChannel).send(payload);
    logInfo(`[WELCOME] ${type === "join" ? "Join" : "Leave"} notice sent for ${member.id}.`);
    return true;
  } catch (error) {
    logWarning(`[WELCOME] Failed for ${member.id}: ${safeReason(error)}.`);
    return false;
  }
}

/** Sends exactly one welcome embed for a human member; all failures stay non-fatal. */
export function sendWelcome(member: GuildMember, config: WelcomeConfig, options: { assetExists?: boolean; channel?: SendableChannel | null } = {}): Promise<boolean> {
  return sendMemberNotice(member, config, "join", options);
}

/** Sends a leave notice for a human member; all failures stay non-fatal. */
export function sendLeave(member: NoticeMember, config: WelcomeConfig, options: { assetExists?: boolean; channel?: SendableChannel | null } = {}): Promise<boolean> {
  return sendMemberNotice(member, config, "leave", options);
}

export async function checkWelcomeChannel(guild: Guild, config: WelcomeConfig): Promise<void> {
  if (!config.channelId) { logWarning("[WELCOME] Channel: not configured."); return; }
  try {
    const channel = await guild.channels.fetch(config.channelId);
    if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("ChannelUnavailable");
    logInfo("[WELCOME] Channel: found.");
  } catch { logWarning("[WELCOME] Channel unavailable."); }
}

export async function testWelcome(interaction: ChatInputCommandInteraction, config: WelcomeConfig): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: "Команда доступна только администраторам сервера.", ephemeral: true }); return; }
  if (!interaction.guild || !interaction.member || !("user" in interaction.member)) { await interaction.reply({ content: "Команда доступна только на сервере.", ephemeral: true }); return; }
  const sent = await sendWelcome(interaction.member as GuildMember, config);
  await interaction.reply({ content: sent ? "Welcome-сообщение отправлено." : "Не удалось отправить welcome-сообщение. Проверьте канал.", ephemeral: true });
}
