import { applicationMembership, applicationMemberRoles } from "./applicationMembership.js";
import { readAccessMember } from "./accessSync.js";
import { ApplicationNotifications } from "./notifications.js";
import { factionRolesManager } from "./factionRoles.js";
import { promotionsManager } from "./promotions.js";
import { deliverRouletteRole } from "./roulette.js";
import { checkAfkRole, notifyAfkApplicant, syncAfkRoles } from "./afk.js";
import { ShopManager } from "./shop.js";
import { loadSiteLogConfig } from "../config/siteLogs.js";
import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { DiscordAPIError, ChannelType, EmbedBuilder, escapeMarkdown, PermissionFlagsBits, type Guild, type GuildMember, type Role } from "discord.js";
import type { ApplicationConfig, Family, FamilyRoleIds } from "../types/family.js";
import { describeDiscordError, logError, logInfo } from "../utils/logger.js";
import { nicknameGuard } from "./nicknameGuard.js";
import type { GiveawayManager, GiveawayPayload } from "./giveaways.js";

type Application = { id: string; family: Family; discordUserId: string; discordUsername: string; discordDisplayName: string; discordTextChannelId: string | null; discordVoiceChannelId: string | null; gameNicknameStatic?: string | null; gameNickname?: string | null; staticId?: string | null; rejectionReason?: string; answers?: { gameNicknameStatic?: string; gameNickname?: string; staticId?: string; oocAge: string; joinReason: string; discoverySource: string; charactersScreenshotUrl: string } | null; submittedAt?: string; reviewer?: { discordId: string; displayName: string } };
type RequestBody = { application?: Application };
type ApplicationOperation = "call" | "accept" | "reject";
export type ApplicationServerEvent = { application: Application; type: "APPLICATION_CALL_STARTED" | "APPLICATION_ACCEPTED" | "APPLICATION_REJECTED"; channelId?: string };
function isFamily(value: unknown): value is Family { return value === "MEMPHIS"; }
type ValidationIssue = { field: string; expected: string; kind: "missing" | "invalid" };
type ApplicationValidation = { ok: true; application: Application } | { ok: false; issues: ValidationIssue[] };

const MAX_REJECTION_REASON_LENGTH = 1_000;
const ACCESS_REQUEST_CHANNEL_ID = process.env.ACCESS_REQUEST_CHANNEL_ID?.trim() || "1560254805283311626";
const ACCESS_ROLE_LABELS: Record<string, string> = { USER: "Участник", RECRUIT: "Рекрутер", HIGH_STAFF: "Старший сотрудник", OWNER: "Владелец" };
function accessRoleLabel(value: unknown): string { return typeof value === "string" ? ACCESS_ROLE_LABELS[value] ?? "Нет доступа" : "Нет доступа"; }
function accessSiteUrl(path: string): string | null {
  const base = process.env.LONDO_SITE_URL?.trim();
  if (!base) return null;
  try { const url = new URL(path, base); return url.protocol === "https:" || url.hostname === "localhost" ? url.href : null; }
  catch { return null; }
}
function isAccessRole(value: unknown): value is string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ACCESS_ROLE_LABELS, value);
}
function validAccessNotification(body: Record<string, unknown>): boolean {
  return typeof body.discordId === "string" && /^\d{17,20}$/.test(body.discordId)
    && isAccessRole(body.requestedRole)
    && isAccessRole(body.memphisRole)
    && isAccessRole(body.phoenixRole)
    && typeof body.displayName === "string" && body.displayName.length <= 100
    && typeof body.username === "string" && body.username.length <= 100
    && (body.requestId === undefined || (typeof body.requestId === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(body.requestId)));
}

export function validateApplicationPayload(
  value: unknown,
  routeApplicationId: string,
  operation: ApplicationOperation,
): ApplicationValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, issues: [{ field: "application", expected: "object", kind: "missing" }] };
  }

  const app = value as Record<string, unknown>;
  const issues: ValidationIssue[] = [];
  const check = (field: string, expected: string, valid: boolean): void => {
    if (!valid) issues.push({ field, expected, kind: app[field] === undefined ? "missing" : "invalid" });
  };

  check("id", "string matching route applicationId", typeof app.id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(app.id) && app.id === routeApplicationId);
  check("family", "string: MEMPHIS", isFamily(app.family));
  check("discordUserId", "string: 17-20 digit Discord snowflake", typeof app.discordUserId === "string" && /^\d{17,20}$/.test(app.discordUserId));
  check("discordUsername", "string", typeof app.discordUsername === "string");
  check("discordDisplayName", "string", typeof app.discordDisplayName === "string");
  check("discordTextChannelId", "string or null", app.discordTextChannelId === null || typeof app.discordTextChannelId === "string");
  check("discordVoiceChannelId", "string or null", app.discordVoiceChannelId === null || typeof app.discordVoiceChannelId === "string");
  if (operation === "accept") {
    check(
      "gameNicknameStatic",
      "string: 1-32 characters",
      typeof app.gameNicknameStatic === "string" && Array.from(app.gameNicknameStatic.trim()).length > 0 && Array.from(app.gameNicknameStatic.trim()).length <= 32,
    );
  }
  if (app.reviewer !== undefined) check("reviewer", "object with Discord ID and display name", Boolean(app.reviewer && typeof app.reviewer === "object" && !Array.isArray(app.reviewer) && typeof (app.reviewer as Record<string, unknown>).discordId === "string" && /^\d{17,20}$/.test((app.reviewer as Record<string, unknown>).discordId as string) && typeof (app.reviewer as Record<string, unknown>).displayName === "string"));
  if (operation === "reject") {
    check(
      "rejectionReason",
      "string: non-empty after trim, maximum 1000 characters",
      typeof app.rejectionReason === "string" && isValidRejectionReason(app.rejectionReason),
    );
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, application: app as Application };
}

function logValidationFailure(operation: string, applicationId: string, issues: ValidationIssue[]): void {
  const missing = issues.filter((issue) => issue.kind === "missing").map((issue) => `${issue.field} (expected ${issue.expected})`);
  const invalid = issues.filter((issue) => issue.kind === "invalid").map((issue) => `${issue.field} (expected ${issue.expected})`);
  logInfo(`[LONDO Bot] Internal API validation failed: operation=${operation}; applicationId=${applicationId}; missing=${missing.join(",") || "none"}; invalid=${invalid.join(",") || "none"}.`);
}
function reply(response: ServerResponse, status: number, body: object): void { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(body)); }
function responseCode(body: object): string { return "code" in body && typeof body.code === "string" ? body.code : "OK"; }
function equalSecret(actual: string | undefined, expected: string): boolean { if (!actual) return false; const a = Buffer.from(actual); const b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b); }
async function readJson(request: IncomingMessage): Promise<unknown> { const chunks: Buffer[] = []; let size = 0; for await (const chunk of request) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > 32_768) throw new Error("Payload too large"); chunks.push(buffer); } return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
function channelName(prefix: string, app: Application): string { const name = app.discordUsername.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 35) || "member"; return `${prefix}-${name}-${app.id.slice(-5)}`; }
class AcceptError extends Error { constructor(readonly code: "MEMBER_NOT_FOUND" | "INVALID_APPLICATION_NICKNAME" | "ROLE_NOT_FOUND" | "MISSING_PERMISSIONS" | "NICKNAME_PERMISSION_MISSING" | "NICKNAME_HIERARCHY" | "ROLE_HIERARCHY" | "ROLE_ASSIGNMENT_FAILED" | "NICKNAME_UPDATE_FAILED") { super(code); } }
type CleanupErrorCode = "CHANNEL_DELETE_FAILED" | "CHANNEL_FETCH_FAILED" | "CHANNEL_OWNERSHIP_MISMATCH" | "MISSING_PERMISSIONS";
class CleanupError extends Error { constructor(readonly code: CleanupErrorCode) { super(code); } }
type CleanupChannel = { type: ChannelType; topic?: string | null; parentId?: string | null; permissionOverwrites?: { cache: { has(id: string): boolean } }; delete(reason?: string): Promise<unknown>; permissionsFor(member: GuildMember): { has(permission: bigint | bigint[]): boolean } | null; };
type CleanupOutcome = "deleted" | "already_absent";
export type CleanupResult = { text: CleanupOutcome; voice: CleanupOutcome };
export type CleanupOperations = { fetchChannel(id: string): Promise<CleanupChannel | null>; canManageChannels(): boolean; canAccessChannel(channel: CleanupChannel): boolean; deleteChannel(channel: CleanupChannel): Promise<void>; };
export function isValidRejectionReason(reason: string | undefined): boolean {
  const trimmed = reason?.trim();
  return Boolean(trimmed && trimmed.length <= MAX_REJECTION_REASON_LENGTH);
}
export function isExpectedTextChannel(channel: { topic?: string | null; type: ChannelType }, applicationId: string): boolean { return channel.type === ChannelType.GuildText && channel.topic === `londo-application:${applicationId}`; }
export function isExpectedVoiceChannel(channel: { parentId?: string | null; permissionOverwrites?: { cache: { has(id: string): boolean } }; type: ChannelType }, categoryId: string, applicantId: string): boolean { return channel.type === ChannelType.GuildVoice && channel.parentId === categoryId && channel.permissionOverwrites?.cache.has(applicantId) === true; }
export function acceptRoleIdsForFamily(family: Family, roleIds: FamilyRoleIds, additional: string[]): string[] { const familyRole = family === "MEMPHIS" ? roleIds.memphis : roleIds.phoenix; return [...new Set([roleIds.fam, familyRole, ...additional])]; }

export async function applyAcceptedApplicationChanges(member: Pick<GuildMember, "id" | "roles" | "setNickname">, roles: Role[], nickname: string): Promise<void> {
  const addedRoleIds: string[] = [];
  try {
    for (const role of roles) {
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role, "LONDO application accepted");
        addedRoleIds.push(role.id);
      }
    }
  } catch {
    await Promise.allSettled(addedRoleIds.map((roleId) => member.roles.remove(roleId, "LONDO application acceptance rollback")));
    throw new AcceptError("ROLE_ASSIGNMENT_FAILED");
  }

  try {
    await nicknameGuard.allowNicknameChange(member.id, () => member.setNickname(nickname, "LONDO application accepted"));
  } catch {
    const rollback = await Promise.allSettled(addedRoleIds.map((roleId) => member.roles.remove(roleId, "LONDO application nickname rollback")));
    if (rollback.some((result) => result.status === "rejected")) {
      logError("Application nickname update failed and role rollback was incomplete.");
    }
    throw new AcceptError("NICKNAME_UPDATE_FAILED");
  }
}

async function startCall(guild: Guild, config: ApplicationConfig, app: Application) {
  logInfo("Application call start received.");
  const applicant = await guild.members.fetch(app.discordUserId);
  const category = await guild.channels.fetch(config.callCategoryId);
  const bot = guild.members.me;
  const staffRoleIds = config.staffRoleIds[app.family];
  if (staffRoleIds.length === 0) throw new Error(`${app.family}_STAFF_ROLES_NOT_CONFIGURED`);
  const staffRoles = await Promise.all(staffRoleIds.map((id) => guild.roles.fetch(id)));
  if (staffRoles.some((role) => !role) || !category || category.type !== ChannelType.GuildCategory || !bot?.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error("CALL_CONFIGURATION_UNAVAILABLE");
  const overwrite = applicationCallOverwrites(
    guild.roles.everyone.id,
    bot.id,
    applicant.id,
    staffRoles.filter((role): role is NonNullable<typeof role> => Boolean(role)).map((role) => role.id),
  );
  const text = await guild.channels.create({ name: channelName("app", app), type: ChannelType.GuildText, parent: category.id, topic: `londo-application:${app.id}`, permissionOverwrites: overwrite });
  logInfo("Application text channel created.");
  let voice: { id: string; delete(reason?: string): Promise<unknown> } | null = null;
  try {
    voice = await guild.channels.create({ name: channelName("call", app), type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: overwrite });
    logInfo("Application voice channel created.");
    const answers = app.answers;
    const date = app.submittedAt ? `<t:${Math.floor(new Date(app.submittedAt).getTime() / 1000)}:f>` : "Не указана";
    const reviewerMention = app.reviewer?.discordId ? `<@${app.reviewer.discordId}>` : "Не указан";
    const embed = new EmbedBuilder().setColor(app.family === "MEMPHIS" ? 0x2dd4bf : 0xf97316).setTitle(`Заявка в семью ${app.family === "MEMPHIS" ? "Memphis" : "Phoenix"}`).setDescription(`**Кандидат:** <@${app.discordUserId}> (${app.discordUsername})\n**Подана:** ${date}\n\n**Игровой никнейм | Статик**\n${answers?.gameNicknameStatic ?? app.gameNicknameStatic ?? "Не указан"}\n\n**Возраст (OOC)**\n${answers?.oocAge ?? "Не указан"}\n\n**Как узнали о семье**\n${answers?.discoverySource ?? "Не указан"}\n\n**Цель вступления в семью**\n${answers?.joinReason ?? "Не указана"}\n\n**Скрин персонажей**\n${answers?.charactersScreenshotUrl ? `[Открыть скриншот](${answers.charactersScreenshotUrl})` : "Не приложен"}\n\n**Статус**\nНа обзвоне у ${reviewerMention}`).setFooter({ text: `Заявка ${app.id}` });
    if (answers?.charactersScreenshotUrl) embed.setThumbnail(answers.charactersScreenshotUrl);
    await text.send({
      content: `<@${app.discordUserId}>, привет!\n\nЭто твой личный канал для рассмотрения заявки в семью.\nНа данный момент твоей заявкой занимается ${reviewerMention}.\nПожалуйста, ожидай дальнейшей связи здесь или в голосовом канале обзвона <#${voice.id}>.`,
      allowedMentions: { users: [app.discordUserId, ...(app.reviewer?.discordId ? [app.reviewer.discordId] : [])] },
    });
    await text.send({ content: reviewerMention, embeds: [embed], allowedMentions: { users: app.reviewer?.discordId ? [app.reviewer.discordId] : [] } });
    logInfo("Application call started successfully."); return { textChannelId: text.id, voiceChannelId: voice.id };
  } catch (error) {
    logError(`Application call setup failed: ${describeDiscordError(error)}`);
    const cleanup = await Promise.allSettled([
      text.delete("Application call setup failed"),
      ...(voice ? [voice.delete("Application call setup failed")] : []),
    ]);
    for (const result of cleanup) {
      if (result.status === "rejected") logError(`Failed to clean up an incomplete application call channel: ${describeDiscordError(result.reason)}`);
    }
    throw error;
  }
}

export function applicationCallOverwrites(guildId: string, botId: string, applicantId: string, staffRoleIds: readonly string[]) {
  const sharedPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak];
  return [
    { id: guildId, deny: [PermissionFlagsBits.ViewChannel] },
    { id: botId, allow: [...sharedPermissions, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
    { id: applicantId, allow: sharedPermissions },
    ...staffRoleIds.map((id) => ({ id, allow: sharedPermissions })),
  ];
}

async function sendApplicantDm(guild: Guild, app: Application, type: "CALL" | "ACCEPTED" | "REJECTED"): Promise<boolean> {
  try {
    const user = await guild.client.users.fetch(app.discordUserId);
    const embed = createApplicantNotification(app, type);
    await user.send({ embeds: [embed], allowedMentions: { users: app.reviewer?.discordId ? [app.reviewer.discordId] : [] } });
    return true;
  } catch { return false; }
}

export function createApplicantNotification(app: Application, type: "CALL" | "ACCEPTED" | "REJECTED"): EmbedBuilder {
    const familyName = app.family === "MEMPHIS" ? "Memphis" : "Phoenix";
    const reviewer = app.reviewer?.discordId ? `<@${app.reviewer.discordId}>` : app.reviewer?.displayName ?? "рекрутер";
    const embed = new EmbedBuilder().setColor(type === "REJECTED" ? 0xef4444 : type === "ACCEPTED" ? 0x22c55e : app.family === "MEMPHIS" ? 0x2dd4bf : 0xf97316);
    if (type !== "REJECTED") embed.setFooter({ text: `Заявка ${app.id}` });
    if (type === "CALL") {
      embed.setTitle("Вас пригласили на собеседование").setDescription(`Здравствуйте, ${app.discordDisplayName}.\n\n${reviewer} пригласил вас на собеседование в семью **${familyName}**. Чтобы присоединиться, откройте каналы ниже.`).addFields({ name: "Текстовый канал", value: app.discordTextChannelId ? `<#${app.discordTextChannelId}>` : "Недоступен", inline: true }, { name: "Голосовой канал", value: app.discordVoiceChannelId ? `<#${app.discordVoiceChannelId}>` : "Недоступен", inline: true });
    } else if (type === "ACCEPTED") {
      embed.setTitle("Заявка одобрена").setDescription(`Здравствуйте, ${app.discordDisplayName}.\n\nВаша заявка в семью **${familyName}** одобрена рекрутом ${reviewer}. Добро пожаловать в семью.`);
    } else {
      embed.setTitle("Спасибо за вашу анкету").setDescription(`Здравствуйте, ${app.discordDisplayName}.\n\nМы внимательно рассмотрели вашу анкету в семью **${familyName}**. К сожалению, сейчас мы не готовы принять вас в семью.\n\n**Комментарий рекрутера**\n${app.rejectionReason?.trim() || "Рекрутер не оставил комментарий."}\n\nСпасибо за интерес к LONDO.`);
    }
    return embed;
}

async function accept(guild: Guild, config: ApplicationConfig, roles: FamilyRoleIds, app: Application): Promise<void> {
  logInfo("Application accept received.");
  const nickname = app.gameNickname?.trim() || app.answers?.gameNickname?.trim() || app.gameNicknameStatic?.split("|")[0]?.trim();
  const staticId = app.staticId?.trim() || app.answers?.staticId?.trim() || app.gameNicknameStatic?.split("|").slice(1).join("|").trim();
  const discordNickname = nickname && staticId ? `${nickname} | ${staticId}` : nickname;
  if (!discordNickname || Array.from(discordNickname).length > 32) throw new AcceptError("INVALID_APPLICATION_NICKNAME");
  let member;
  try { member = await guild.members.fetch(app.discordUserId); logInfo("Applicant member: found."); }
  catch { logInfo("Applicant member: not found."); throw new AcceptError("MEMBER_NOT_FOUND"); }
  const bot = guild.members.me;
  if (!bot?.permissions.has(PermissionFlagsBits.ManageRoles)) throw new AcceptError("MISSING_PERMISSIONS");
  if (!bot.permissions.has(PermissionFlagsBits.ManageNicknames)) throw new AcceptError("NICKNAME_PERMISSION_MISSING");
  if (member.roles.highest.comparePositionTo(bot.roles.highest) >= 0) throw new AcceptError("NICKNAME_HIERARCHY");
  const additionalRoleIds = config.acceptRoleIds[app.family];
  const ids = acceptRoleIdsForFamily(app.family, roles, additionalRoleIds);
  let grantRoles;
  try { grantRoles = await Promise.all(ids.map((id) => guild.roles.fetch(id))); } catch { throw new AcceptError("ROLE_NOT_FOUND"); }
  const famRole = grantRoles[0]; const familyRole = grantRoles[1];
  logInfo(`FAM role: ${famRole ? "found" : "not found"}.`);
  logInfo(`Family role: ${familyRole ? "found" : "not found"}.`);
  logInfo(`Additional accept roles: ${additionalRoleIds.length}.`);
  if (!famRole || !familyRole || grantRoles.some((role) => !role)) throw new AcceptError("ROLE_NOT_FOUND");
  const resolvedRoles = grantRoles.filter((role): role is Role => Boolean(role));
  if (resolvedRoles.some((role) => !role.editable)) { logInfo("Role hierarchy: FAILED."); throw new AcceptError("ROLE_HIERARCHY"); }
  logInfo("Role hierarchy: OK.");
  await applyAcceptedApplicationChanges(member, resolvedRoles, discordNickname);
  logInfo("Application roles and nickname updated successfully.");
}

function channelMissing(error: unknown): boolean { return error instanceof DiscordAPIError && error.code === 10003; }
function permissionError(error: unknown): boolean { return error instanceof DiscordAPIError && (error.code === 50001 || error.code === 50013); }
function safeServerError(error: unknown): string { if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code; return error instanceof Error ? error.name : "unknown error"; }

function cleanupOperations(guild: Guild): CleanupOperations {
  const bot = guild.members.me;
  return {
    fetchChannel: async (id) => await guild.channels.fetch(id) as unknown as CleanupChannel | null,
    canManageChannels: () => Boolean(bot?.permissions.has(PermissionFlagsBits.ManageChannels)),
    canAccessChannel: (channel) => Boolean(bot && channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels])),
    deleteChannel: async (channel) => { await channel.delete("LONDO application completed"); },
  };
}

async function cleanupChannel(kind: "text" | "voice", channelId: string | null, app: Application, categoryId: string, operations: CleanupOperations): Promise<CleanupOutcome> {
  logInfo(`[Application] ${kind} id ${channelId ? "present" : "missing"}.`);
  if (!channelId) return "already_absent";
  let channel: CleanupChannel | null;
  try { channel = await operations.fetchChannel(channelId); }
  catch (error) { if (channelMissing(error)) { logInfo(`[Application] ${kind} fetch not found.`); return "already_absent"; } throw new CleanupError(permissionError(error) ? "MISSING_PERMISSIONS" : "CHANNEL_FETCH_FAILED"); }
  if (!channel) { logInfo(`[Application] ${kind} fetch not found.`); return "already_absent"; }
  logInfo(`[Application] ${kind} fetch found.`);
  const ownershipValid = kind === "text" ? isExpectedTextChannel(channel, app.id) : isExpectedVoiceChannel(channel, categoryId, app.discordUserId);
  if (!ownershipValid) { logInfo(`[Application] ${kind} ownership FAILED.`); throw new CleanupError("CHANNEL_OWNERSHIP_MISMATCH"); }
  logInfo(`[Application] ${kind} ownership OK.`);
  if (!operations.canManageChannels() || !operations.canAccessChannel(channel)) throw new CleanupError("MISSING_PERMISSIONS");
  try { logInfo(`[Application] deleting ${kind}.`); await operations.deleteChannel(channel); logInfo(`[Application] ${kind} deleted.`); return "deleted"; }
  catch (error) { throw new CleanupError(permissionError(error) ? "MISSING_PERMISSIONS" : "CHANNEL_DELETE_FAILED"); }
}

export async function cleanupApplicationChannels(app: Application, categoryId: string, operations: CleanupOperations): Promise<CleanupResult> {
  logInfo(`[Application] cleanup started. Application: ${app.id}.`);
  try {
    const text = await cleanupChannel("text", app.discordTextChannelId, app, categoryId, operations);
    const voice = await cleanupChannel("voice", app.discordVoiceChannelId, app, categoryId, operations);
    logInfo("[Application] cleanup completed.");
    return { text, voice };
  } catch (error) {
    const code = error instanceof CleanupError ? error.code : "CHANNEL_DELETE_FAILED";
    logInfo(`[Application] cleanup failed: ${code}.`);
    throw error instanceof CleanupError ? error : new CleanupError(code);
  }
}

async function cleanupDiscordApplicationChannels(guild: Guild, config: ApplicationConfig, app: Application): Promise<CleanupResult> {
  return cleanupApplicationChannels(app, config.callCategoryId, cleanupOperations(guild));
}

async function reject(guild: Guild, config: ApplicationConfig, app: Application): Promise<CleanupResult> {
  logInfo("Application reject received.");
  const reason = app.rejectionReason?.trim();
  if (!isValidRejectionReason(reason)) throw new Error("INVALID_REJECTION_REASON");
  if (app.discordTextChannelId) {
    try { const channel = await guild.channels.fetch(app.discordTextChannelId); if (channel?.isTextBased() && channel.isSendable() && isExpectedTextChannel(channel, app.id)) await channel.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle("Решение по вашей анкете").setDescription(`Мы рассмотрели вашу анкету в семью ${app.family === "MEMPHIS" ? "Memphis" : "Phoenix"}. К сожалению, сейчас мы не готовы принять вас.\n\n**Комментарий рекрутера**\n${reason}\n\nСпасибо за интерес к LONDO.`)] }); } catch (error) { if (!channelMissing(error)) throw new CleanupError(permissionError(error) ? "MISSING_PERMISSIONS" : "CHANNEL_FETCH_FAILED"); }
  }
  const cleanup = await cleanupDiscordApplicationChannels(guild, config, app); logInfo("Application rejected successfully."); return cleanup;
}

export function startApplicationServer(guild: Guild, config: ApplicationConfig, roles: FamilyRoleIds, secret: string, onEvent?: (event: ApplicationServerEvent) => void, giveawayManager?: GiveawayManager | null): Server {
  const shopConfig = loadSiteLogConfig();
  const shop = shopConfig ? new ShopManager(guild, shopConfig) : null;
  const factionRoles = shopConfig ? factionRolesManager(guild, shopConfig) : null;
  const promotions = shopConfig ? promotionsManager(guild, shopConfig, roles, config) : null;
  const completedCalls = new Map<string, { textChannelId: string; voiceChannelId: string }>();
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const respond = (status: number, body: object): void => { logInfo(`[LONDO Bot] Internal API response: status=${status}; code=${responseCode(body)}.`); reply(response, status, body); };
    logInfo(`[LONDO Bot] Internal API request received: method=${request.method ?? "UNKNOWN"}; pathname=${pathname}.`);
    const isShop = pathname.startsWith("/internal/discord/shop/");
    const isGiveawayOptions = pathname === "/internal/discord/giveaway-options";
    if (request.method !== "POST" && !(request.method === "GET" && (isGiveawayOptions || isShop))) { respond(405, { ok: false, code: "INVALID_REQUEST" }); return; }
    if (!equalSecret(request.headers["x-londo-bot-secret"] as string | undefined, secret)) { logInfo("[LONDO Bot] Internal API authorization: unauthorized."); respond(401, { ok: false, code: "UNAUTHORIZED" }); return; }
    logInfo("[LONDO Bot] Internal API authorization: authorized.");
    if (pathname === "/internal/discord/applications/member" || pathname === "/internal/discord/applications/member-roles") {
      try { const body = await readJson(request) as {discordId?:unknown};
        if (!body || typeof body.discordId !== "string" || !/^\d{17,20}$/.test(body.discordId)) { respond(400,{code:"INVALID_INPUT"}); return; }
        respond(200,await (pathname.endsWith("member-roles")?applicationMemberRoles:applicationMembership)(guild,body.discordId));
      } catch { respond(200,{status:"UNAVAILABLE"}); }
      return;
    }
    if (pathname === "/internal/discord/profile/nickname") {
      try {
        const body = await readJson(request) as { discordUserId?: unknown; staticId?: unknown; gameNickname?: unknown };
        if (typeof body.discordUserId !== "string" || !/^\d{17,20}$/.test(body.discordUserId) || (body.staticId !== null && body.staticId !== undefined && (typeof body.staticId !== "string" || !/^[^\r\n\t]{1,30}$/.test(body.staticId.trim()))) || (body.gameNickname !== null && body.gameNickname !== undefined && (typeof body.gameNickname !== "string" || !/^[^\r\n\t]{1,32}$/.test(body.gameNickname.trim())))) { respond(400, { code: "INVALID_INPUT" }); return; }
        const member = await guild.members.fetch(body.discordUserId);
        const current = member.nickname?.replace(/\s*\|\s*\d+\s*$/, "") || member.displayName;
        const nickname = typeof body.gameNickname === "string" && body.gameNickname.trim() ? body.gameNickname.trim() : current;
        const staticId = typeof body.staticId === "string" && body.staticId.trim() ? body.staticId.trim() : null;
        await nicknameGuard.allowNicknameChange(member.id, () => member.setNickname((staticId ? `${nickname} | ${staticId}` : nickname).slice(0, 32), "LONDO profile identity updated"));
        respond(200, { ok: true });
      } catch { respond(503, { code: "PROFILE_NICKNAME_UNAVAILABLE" }); }
      return;
    }
    if (pathname === "/internal/discord/access/member") {
      try {
        const body = await readJson(request) as { discordId?: unknown };
        if (!body || typeof body.discordId !== "string" || !/^\d{17,20}$/.test(body.discordId)) { respond(400, { code: "INVALID_INPUT" }); return; }
        respond(200, await readAccessMember(guild, body.discordId));
      } catch { respond(503, { code: "ACCESS_UNAVAILABLE" }); }
      return;
    }
    if (pathname === "/internal/discord/access/request" || pathname === "/internal/discord/access/approved") {
      try {
        const body = await readJson(request) as Record<string, unknown>;
        if (!body || !validAccessNotification(body) || (pathname.endsWith("/request") && typeof body.requestId !== "string")) { respond(400, { code: "INVALID_INPUT" }); return; }
        const discordId = body.discordId as string;
        const displayName = escapeMarkdown((body.displayName as string).trim()).slice(0, 100);
        const username = escapeMarkdown((body.username as string).trim()).slice(0, 100);
        const accessUrl = accessSiteUrl(pathname.endsWith("/request") ? "/access/manage" : "/access/pin/setup");
        const scopes = `MEMPHIS: ${accessRoleLabel(body.memphisRole)}`;
        if (pathname.endsWith("/request")) {
          if (!/^\d{17,20}$/.test(ACCESS_REQUEST_CHANNEL_ID)) { respond(503, { code: "ACCESS_CHANNEL_NOT_CONFIGURED" }); return; }
          const channel = await guild.channels.fetch(ACCESS_REQUEST_CHANNEL_ID);
          if (!channel?.isTextBased() || !channel.isSendable()) { respond(503, { code: "ACCESS_CHANNEL_UNAVAILABLE" }); return; }
          const embed = new EmbedBuilder()
            .setColor(0xe6b77a)
            .setTitle("Новый запрос доступа к сайту")
            .setDescription(`**${displayName}** (@${username}) запросил доступ на сайт LONDO.`)
            .addFields(
              { name: "Уровень доступа", value: accessRoleLabel(body.requestedRole), inline: true },
              { name: "Доступ по серверам", value: scopes },
              { name: "Discord ID", value: discordId, inline: true },
              { name: "Номер заявки", value: String(body.requestId), inline: true },
            )
            .setFooter({ text: "LONDO • управление доступом" })
            .setTimestamp();
          if (accessUrl) embed.setURL(accessUrl);
          await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
          respond(200, { ok: true });
          return;
        }
        const user = await guild.client.users.fetch(discordId);
        const embed = new EmbedBuilder()
          .setColor(0x54b987)
          .setTitle("Доступ на сайт LONDO одобрен")
          .setDescription(`Здравствуйте, **${displayName}**! Ваш запрос на доступ к сайту одобрен.`)
          .addFields(
            { name: "Ваш уровень доступа", value: accessRoleLabel(body.requestedRole), inline: true },
            { name: "Доступ по серверам", value: scopes },
            { name: "Следующий шаг", value: "Войдите на сайт и создайте четырёхзначный защитный код. Он понадобится для подтверждения доступа к панели." },
          )
          .setFooter({ text: "LONDO • добро пожаловать в команду" })
          .setTimestamp();
        if (user.displayAvatarURL()) embed.setThumbnail(user.displayAvatarURL({ size: 128 }));
        if (accessUrl) embed.setURL(accessUrl);
        await user.send({ embeds: [embed] });
        respond(200, { ok: true });
      } catch (error) {
        logInfo(`[ACCESS] Discord notification failed: ${error instanceof Error ? error.message : "UNKNOWN"}.`);
        respond(503, { code: "ACCESS_NOTIFICATION_FAILED" });
      }
      return;
    }
    if(pathname==="/internal/discord/notifications/options"){if(!shopConfig){respond(503,{code:"UNAVAILABLE"});return;}try{respond(200,await new ApplicationNotifications(guild,shopConfig).options());}catch{respond(503,{code:"UNAVAILABLE"});}return;}
    if (pathname.startsWith("/internal/discord/faction-roles/")) {
      if (!factionRoles) { respond(503,{code:"FACTION_ROLES_UNAVAILABLE"}); return; }
      try {const body=await readJson(request) as {actorDiscordId?:string};
        if(pathname==="/internal/discord/faction-roles/options"){respond(200,await factionRoles.options());return;}
        if((pathname==="/internal/discord/faction-roles/publish"||pathname==="/internal/discord/faction-roles/refresh")&&typeof body.actorDiscordId==="string"&&/^\d{17,20}$/.test(body.actorDiscordId)){respond(200,await factionRoles.publish(body.actorDiscordId));return;}
        respond(400,{code:"INVALID_INPUT"});
      }catch{respond(503,{code:"FACTION_ROLES_UNAVAILABLE"});}
      return;
    }
    if (pathname.startsWith("/internal/discord/promotions/")) {
      if (!promotions) { respond(503,{code:"PROMOTIONS_UNAVAILABLE"}); return; }
      try { const body = await readJson(request) as {family?:Family;discordUserId?:string;roleId?:string;applicationId?:string};
        if (pathname.endsWith("/options")) { respond(200,await promotions.options(body.family)); return; }
        if (pathname.endsWith("/refresh")) { respond(200,await promotions.refresh(body.family)); return; }
        if (pathname.endsWith("/notify")) { respond(200,await promotions.notify(body)); return; }
        if (pathname.endsWith("/check") && body.discordUserId && body.roleId && isFamily(body.family)) { respond(200,await promotions.check(body.discordUserId,body.roleId,body.family)); return; }
        if (pathname.endsWith("/apply") && typeof body.applicationId === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(body.applicationId)) { respond(200,await promotions.apply(body.applicationId)); return; }
        respond(400,{code:"INVALID_INPUT"});
      } catch { respond(503,{code:"PROMOTIONS_UNAVAILABLE"}); }
      return;
    }
    if (pathname === "/internal/discord/roulette/deliver") {
      try { respond(200, await deliverRouletteRole(guild, await readJson(request))); }
      catch { respond(503, { code: "ROULETTE_DELIVERY_PENDING" }); }
      return;
    }
    if (pathname.startsWith("/internal/discord/afk/")) {
      try { const body = await readJson(request) as Parameters<typeof syncAfkRoles>[2] & {family: Family};
        if (pathname === "/internal/discord/afk/notify" && ["APPROVED","REJECTED","ENDED","ENDED_EARLY"].includes(String((body as {type?:unknown}).type)) && isFamily(body.family) && /^\d{17,20}$/.test(body.discordUserId)) { respond(200,await notifyAfkApplicant(guild,body as unknown as Parameters<typeof notifyAfkApplicant>[1])); return; }
        if (pathname === "/internal/discord/afk/check" && isFamily(body.family) && /^\d{17,20}$/.test(body.discordUserId)) { respond(200,await checkAfkRole(guild,roles,body.discordUserId,body.family)); return; }
        if (pathname === "/internal/discord/afk/sync") {respond(200,await syncAfkRoles(guild,roles,body));return;}
        respond(400,{code:"INVALID_INPUT"});
      } catch { respond(503,{code:"AFK_UNAVAILABLE"}); }
      return;
    }
    if (isShop) {
      if (!shop) { respond(503,{code:"SHOP_UNAVAILABLE"}); return; }
      try {
        if (request.method === "GET" && pathname === "/internal/discord/shop/options") { respond(200,await shop.options()); return; }
        if (request.method !== "POST") { respond(405,{code:"INVALID_REQUEST"}); return; }
        const body = await readJson(request) as {family?:string;discordUserId?:string;roleId?:string};
        if (pathname === "/internal/discord/shop/refresh" && isFamily(body.family)) { await shop.refresh(body.family); respond(200,{ok:true}); return; }
        if (pathname === "/internal/discord/shop/role-check" && /^\d{17,20}$/.test(body.discordUserId || "") && /^\d{17,20}$/.test(body.roleId || "")) { respond(200,await shop.roleCheck(body.discordUserId!,body.roleId!)); return; }
        respond(400,{code:"INVALID_REQUEST"});
      } catch { respond(503,{code:"SHOP_UNAVAILABLE"}); }
      return;
    }
    if (isGiveawayOptions) {
      const bot = guild.members.me;
      const channels = guild.channels.cache
        .filter((channel) => (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) && Boolean(bot && channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory])))
        .map((channel) => ({ id: channel.id, name: channel.name }))
        .sort((left, right) => left.name.localeCompare(right.name));
      const roles = guild.roles.cache
        .filter((role) => role.id !== guild.id && !role.managed)
        .map((role) => ({ id: role.id, name: role.name }))
        .sort((left, right) => left.name.localeCompare(right.name));
      respond(200, { channels, roles });
      return;
    }
    const giveawayMatch = /^\/internal\/giveaways\/([a-zA-Z0-9_-]{1,64})\/(publish|refresh|delete)$/.exec(pathname);
    if (giveawayMatch) {
      if (!giveawayManager) { respond(503, { ok: false, code: "GIVEAWAYS_UNAVAILABLE" }); return; }
      try {
        const body = await readJson(request) as { giveaway?: GiveawayPayload };
        if (!body.giveaway || body.giveaway.id !== giveawayMatch[1]) { respond(400, { ok: false, code: "INVALID_REQUEST" }); return; }
        if (giveawayMatch[2] === "publish") { const messageId = await giveawayManager.publish(body.giveaway); respond(200, { ok: true, messageId }); return; }
        if (giveawayMatch[2] === "refresh") { await giveawayManager.refresh(body.giveaway); respond(200, { ok: true }); return; }
        await giveawayManager.deleteMessage(body.giveaway); respond(200, { ok: true }); return;
      } catch (error) { const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "DISCORD_OPERATION_FAILED"; respond(503, { ok: false, code }); return; }
    }
    const notificationMatch = /^\/internal\/applications\/([a-zA-Z0-9_-]{1,64})\/notify$/.exec(pathname);
    if (notificationMatch) {
      try {
        const body = await readJson(request) as RequestBody & { notificationType?: unknown };
        const type = body.notificationType;
        if (type !== "CALL" && type !== "ACCEPTED" && type !== "REJECTED") { respond(400, { ok: false, code: "INVALID_REQUEST" }); return; }
        const validation = validateApplicationPayload(body.application, notificationMatch[1], "call");
        if (!validation.ok) { logValidationFailure("notify", notificationMatch[1], validation.issues); respond(400, { ok: false, code: "INVALID_REQUEST" }); return; }
        const app = validation.application;
        if (type === "REJECTED" && !isValidRejectionReason(app.rejectionReason)) { respond(400, { ok: false, code: "INVALID_REJECTION_REASON" }); return; }
        const delivered = await sendApplicantDm(guild, app, type);
        respond(200, { ok: true, delivered });
      } catch { respond(200, { ok: true, delivered: false }); }
      return;
    }
    const match = /^\/internal\/applications\/([a-zA-Z0-9_-]{1,64})\/(call|accept|reject)$/.exec(pathname); if (!match) { respond(404, { ok: false, code: "ROUTE_NOT_FOUND" }); return; }
    const operation = match[2] as ApplicationOperation;
    logInfo(`[LONDO Bot] Internal API operation matched: operation=${operation}; applicationId=${match[1]}.`);
    try { const body = await readJson(request) as RequestBody; const validation = validateApplicationPayload(body.application, match[1], operation); if (!validation.ok) { logValidationFailure(operation, match[1], validation.issues); respond(400, { ok: false, code: "INVALID_REQUEST" }); return; } const app = validation.application;
      if (operation === "call") { const existing = completedCalls.get(app.id); const channels = existing ?? await startCall(guild, config, app); completedCalls.set(app.id, channels); if (!existing) onEvent?.({ application: app, type: "APPLICATION_CALL_STARTED", channelId: channels.textChannelId }); respond(200, { ok: true, ...channels }); return; }
      if (operation === "accept") { await accept(guild, config, roles, app); const cleanup = await cleanupDiscordApplicationChannels(guild, config, app); logInfo("Application accepted successfully."); onEvent?.({ application: app, type: "APPLICATION_ACCEPTED", channelId: app.discordTextChannelId ?? undefined }); respond(200, { ok: true, cleanup }); return; }
      const cleanup = await reject(guild, config, app); onEvent?.({ application: app, type: "APPLICATION_REJECTED", channelId: app.discordTextChannelId ?? undefined }); respond(200, { ok: true, cleanup });
    } catch (error) {
      const code = error instanceof AcceptError || error instanceof CleanupError
        ? error.code
        : error instanceof DiscordAPIError && error.code === 50001
          ? "MISSING_ACCESS"
          : error instanceof DiscordAPIError && error.code === 50013
            ? "MISSING_PERMISSIONS"
            : error instanceof Error
              ? error.message
              : "DISCORD_OPERATION_FAILED";
      respond(503, { ok: false, code: /^[A-Z_]+$/.test(code) ? code : "DISCORD_OPERATION_FAILED", ...(error instanceof CleanupError ? { operation: "cleanup" } : {}) });
    }
  });
  const host = process.env.LONDO_BOT_HOST?.trim() || "127.0.0.1";
  server.once("listening", () => { const address = server.address(); const port = typeof address === "object" && address ? address.port : config.port; logInfo(`Internal API listening on http://${host}:${port}`); });
  server.once("error", (error) => { logError(`Internal API failed to start: ${safeServerError(error)}`); });
  server.on("close", () => { logInfo("Internal API closed."); });
  server.listen(config.port, host);
  return server;
}
