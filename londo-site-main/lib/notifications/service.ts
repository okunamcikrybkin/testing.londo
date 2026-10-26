import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { shopBot, type DiscordOptions } from "@/lib/shop/bot";
import { familyOf, object, snowflake } from "@/lib/promotions/validation";
import { notificationContent, notificationDestination, type NotificationField, type NotificationKind } from "./policy";

type Db = Prisma.TransactionClient;
type Family = "MEMPHIS";
type QueueEvent = { id: string; action: string; target_id: string };
type ResolutionEvent = { eventId: string; family: Family; channelId: string; messageId: string; action: string; target_id: string };

export async function settings(db: Db = prisma) {
  for (const family of ["MEMPHIS"] as const) {
    await db.familyNotificationSettings.upsert({ where: { family }, update: {}, create: { family } });
  }
  return db.familyNotificationSettings.findMany({ where: { family: "MEMPHIS" }, orderBy: { family: "asc" } });
}

export function options() {
  return shopBot<DiscordOptions>("/internal/discord/notifications/options", {});
}

export async function save(value: unknown, actorId: string) {
  const body = object(value);
  const family = familyOf(body.family);
  const available = await options();
  const channelId = body.channelId ? snowflake(body.channelId) : null;
  if (channelId && !available.channels.some((channel) => channel.id === channelId)) throw Error("Канал недоступен.");
  const role = (value: unknown) => {
    if (!value) return null;
    const id = snowflake(value);
    if (!available.roles.some((item) => item.id === id)) throw Error("Роль недоступна.");
    return id;
  };
  const data = {
    channelId,
    applicationPingRoleId: role(body.applicationPingRoleId),
    promotionPingRoleId: role(body.promotionPingRoleId),
    vacationPingRoleId: role(body.vacationPingRoleId),
    vacationMaxHours: Number.isInteger(body.vacationMaxHours) && Number(body.vacationMaxHours) >= 1 && Number(body.vacationMaxHours) <= 720 ? Number(body.vacationMaxHours) : 168,
  };
  await settings();
  await prisma.$transaction(async (tx) => {
    if (channelId && await tx.familyNotificationSettings.findFirst({ where: { channelId, family: { not: family } } })) throw Error("CHANNEL_ALREADY_USED");
    await tx.familyNotificationSettings.update({ where: { family }, data });
    await tx.auditLog.create({ data: { actorId, action: "NOTIFICATION_SETTINGS_UPDATED", targetType: "FamilyNotificationSettings", targetId: family, metadata: { family, ...data } } });
  });
  return settings();
}

function jsonValue(value: unknown, key: string, fallback = "Не указано") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" && item.trim() ? item : fallback;
}

function date(value: Date | null | undefined) {
  return value ? `${value.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} (МСК)` : "Не указано";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function kindFor(action: string): NotificationKind {
  return action === "APPLICATION_CREATED" ? "APPLICATION" : action === "PROMOTION_APPLICATION_CREATED" ? "PROMOTION" : "VACATION";
}

async function applicationFor(kind: NotificationKind, id: string, db: Db) {
  if (kind === "APPLICATION") return db.familyApplication.findUnique({ where: { id }, include: { reviewedBy: { select: { discordId: true, displayName: true, username: true } } } });
  if (kind === "PROMOTION") return db.promotionApplication.findUnique({ where: { id }, include: { identity: true } });
  return db.afkApplication.findUnique({ where: { id }, include: { identity: true, reviewer: { select: { discordId: true, displayName: true, username: true } } } });
}

async function details(kind: NotificationKind, app: unknown, db: Db) {
  const data = app as Record<string, unknown>;
  let participantName = "Участник";
  let fields: NotificationField[] = [];
  let reviewerName: string | null = null;
  let reviewerId: string | null = null;

  if (kind === "APPLICATION") {
    participantName = String(data.discordDisplayName ?? participantName);
    const reviewer = record(data.reviewedBy);
    reviewerId = typeof reviewer.discordId === "string" ? reviewer.discordId : null;
    reviewerName = typeof reviewer.displayName === "string" ? reviewer.displayName : typeof reviewer.username === "string" ? reviewer.username : null;
    fields = [
      { name: "Discord", value: `${String(data.discordUsername ?? "Не указан")} · ${String(data.discordUserId ?? "Не указан")}` },
      { name: "Подано", value: date(data.createdAt as Date), inline: true },
      { name: "Игровой никнейм / статик", value: jsonValue(data.answers, "gameNicknameStatic") },
      { name: "Возраст OOC", value: jsonValue(data.answers, "oocAge"), inline: true },
    ];
  } else if (kind === "PROMOTION") {
    const snapshot = data.identitySnapshot as Record<string, unknown> | undefined;
    participantName = typeof snapshot?.displayName === "string" ? snapshot.displayName : participantName;
    if (data.reviewedByDiscordId) {
      const reviewer = await db.user.findUnique({ where: { discordId: String(data.reviewedByDiscordId) }, select: { displayName: true, username: true } });
      reviewerId = String(data.reviewedByDiscordId);
      reviewerName = reviewer?.displayName ?? reviewer?.username ?? String(data.reviewedByDiscordId);
    }
    fields = [
      { name: "Текущий ранг", value: String(data.currentRank ?? "Не указан"), inline: true },
      { name: "Запрашиваемый ранг", value: String(data.rankName ?? "Не указан"), inline: true },
      { name: "Подано", value: date(data.createdAt as Date), inline: true },
      { name: "Причина", value: jsonValue(data.answers, "reason") },
    ];
  } else {
    const identity = record(data.identity);
    const reviewer = record(data.reviewer);
    participantName = typeof identity.displayName === "string" ? identity.displayName : participantName;
    reviewerName = typeof reviewer.displayName === "string" ? reviewer.displayName : typeof reviewer.username === "string" ? reviewer.username : typeof data.reviewedByDiscordId === "string" ? data.reviewedByDiscordId : null;
    reviewerId = typeof reviewer.discordId === "string" ? reviewer.discordId : typeof data.reviewedByDiscordId === "string" ? data.reviewedByDiscordId : null;
    const start = data.requestedStartAt as Date;
    const end = data.requestedEndAt as Date;
    fields = [
      { name: "Период отпуска", value: `${date(start)} — ${date(end)}` },
      { name: "Длительность", value: (() => { const minutes = Math.max(0, Math.round((+end - +start) / 60000)); const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), rest = minutes % 60; return [days ? `${days} дн.` : "", hours ? `${hours} ч.` : "", rest ? `${rest} мин.` : ""].filter(Boolean).join(" ") || "меньше минуты"; })(), inline: true },
      { name: "Причина", value: String(data.reason ?? "Не указана") },
    ];
  }

  return { participantName, fields, reviewerName, reviewerId };
}

function isResolved(kind: NotificationKind, status: string) {
  return kind === "APPLICATION" ? ["ACCEPTED", "REJECTED"].includes(status) : ["APPROVED", "REJECTED"].includes(status);
}

async function claimInfo(kind: NotificationKind, app: unknown, db: Db) {
  const data = app as Record<string, unknown>;
  const discordId = kind === "APPLICATION" ? null : typeof data.claimedByDiscordId === "string" ? data.claimedByDiscordId : null;
  const user = kind === "APPLICATION" && typeof data.claimedByUserId === "string"
    ? await db.user.findUnique({ where: { id: data.claimedByUserId }, select: { displayName: true, username: true, discordId: true } })
    : discordId ? await db.user.findUnique({ where: { discordId }, select: { displayName: true, username: true, discordId: true } }) : null;
  if (!user) return null;
  return { reviewerName: user.displayName || user.username, reviewerId: user.discordId };
}

async function makeItem(event: { eventId: string; family: Family; channelId: string; messageId?: string; action: string; target_id: string; updateType?: "CLAIM" | "RESOLUTION" }, configs: Awaited<ReturnType<typeof settings>>, db: Db) {
  const kind = kindFor(event.action);
  const app = await applicationFor(kind, event.target_id, db);
  if (!app) return null;
  const destination = notificationDestination(configs, app.family, kind);
  if (!destination) return null;
  const info = await details(kind, app, db);
  const claim = event.updateType === "CLAIM" ? await claimInfo(kind, app, db) : null;
  return {
    eventId: event.eventId,
    family: app.family,
    kind,
    ...destination,
    ...notificationContent(app.family, kind, app.id, app.discordUserId, info.participantName, info.fields),
    ...(event.messageId ? {
      mode: "UPDATE" as const,
      messageId: event.messageId,
      ...(event.updateType === "CLAIM" && claim ? { claim } : { resolution: {
        status: app.status,
        reviewerName: info.reviewerName ?? "Рекрут не указан",
        reviewerId: info.reviewerId,
        reason: "rejectionReason" in app ? (app.rejectionReason ?? null) : null,
        resolvedAt: "reviewedAt" in app ? app.reviewedAt : ("completedAt" in app ? app.completedAt : null),
      } }),
    } : { mode: "CREATE" as const }),
  };
}

export async function queue(db: Db = prisma) {
  const configs = await settings(db);
  if (!configs.some((config) => config.channelId)) return [];
  const created = await db.$queryRaw<QueueEvent[]>`
    SELECT a.id, a.action, a.target_id
    FROM audit_logs a
    LEFT JOIN application_notification_receipts r ON r."eventId" = a.id
    JOIN family_notification_settings s ON s.family::text = a.metadata->>'family'
    WHERE r."eventId" IS NULL AND s."channelId" IS NOT NULL AND a.created_at >= s."createdAt"
      AND a.action IN ('APPLICATION_CREATED','PROMOTION_APPLICATION_CREATED','AFK_APPLICATION_CREATED')
    ORDER BY a.created_at, a.id LIMIT 100`;
  const updates = await db.$queryRaw<ResolutionEvent[]>`
    SELECT r."eventId", r.family, r."channelId", r."messageId", a.action, a.target_id
    FROM application_notification_receipts r
    JOIN audit_logs a ON a.id = r."eventId"
    WHERE r."resolved_state" IS NULL
      AND a.action IN ('APPLICATION_CREATED','PROMOTION_APPLICATION_CREATED','AFK_APPLICATION_CREATED')
    ORDER BY r."createdAt" LIMIT 100`;
  const items = [];
  for (const event of created) {
    const item = await makeItem({ eventId: event.id, family: "MEMPHIS", channelId: "", action: event.action, target_id: event.target_id }, configs, db);
    if (item) items.push(item);
  }
  for (const event of updates) {
    const kind = kindFor(event.action);
    const app = await applicationFor(kind, event.target_id, db);
    if (!app || !isResolved(kind, app.status)) continue;
    const item = await makeItem(event, configs, db);
    if (item) items.push(item);
  }
  const claims = await db.$queryRaw<ResolutionEvent[]>`
    SELECT r."eventId", r.family, r."channelId", r."messageId", a.action, a.target_id
    FROM application_notification_receipts r
    JOIN audit_logs a ON a.id = r."eventId"
    WHERE r."claimed_state" IS NULL
      AND a.action IN ('APPLICATION_CREATED','PROMOTION_APPLICATION_CREATED','AFK_APPLICATION_CREATED')
    ORDER BY r."createdAt" LIMIT 100`;
  for (const event of claims) {
    const kind = kindFor(event.action);
    const app = await applicationFor(kind, event.target_id, db);
    if (!app || isResolved(kind, app.status) || !(await claimInfo(kind, app, db))) continue;
    const item = await makeItem({ ...event, updateType: "CLAIM" }, configs, db);
    if (item) items.push(item);
  }
  return items;
}

export async function receipt(value: unknown, db: Db = prisma) {
  const body = object(value);
  const family = familyOf(body.family);
  const channelId = snowflake(body.channelId);
  const messageId = snowflake(body.messageId);
  if (typeof body.eventId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.eventId)) throw Error("Неизвестное событие.");
  const item = (await queue(db)).find((entry) => entry.eventId === body.eventId && entry.mode === "CREATE");
  if (!item || item.family !== family || item.channelId !== channelId) throw Error("Настройки уведомлений изменились.");
  return db.applicationNotificationReceipt.upsert({ where: { eventId: body.eventId }, create: { eventId: body.eventId, family, channelId, messageId }, update: {} });
}

export async function resolutionReceipt(value: unknown, db: Db = prisma) {
  const body = object(value);
  const family = familyOf(body.family);
  const channelId = snowflake(body.channelId);
  const messageId = snowflake(body.messageId);
  const state = typeof body.state === "string" ? body.state : null;
  if (!state || typeof body.eventId !== "string") throw Error("Некорректное состояние уведомления.");
  return db.applicationNotificationReceipt.updateMany({ where: { eventId: body.eventId, family, channelId, messageId, resolvedState: null }, data: { resolvedState: state } });
}

export async function claimReceipt(value: unknown, db: Db = prisma) {
  const body = object(value);
  const family = familyOf(body.family);
  const channelId = snowflake(body.channelId);
  const messageId = snowflake(body.messageId);
  const state = typeof body.state === "string" ? body.state : null;
  if (!state || typeof body.eventId !== "string") throw Error("Некорректное состояние закрепления.");
  return db.applicationNotificationReceipt.updateMany({ where: { eventId: body.eventId, family, channelId, messageId, claimedState: null }, data: { claimedState: state } });
}
