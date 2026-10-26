import type { AuditLog, Family, LogEvent, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { VACATION_ACTION_LABELS, LOG_CATEGORIES, type LogCategoryFilter, type LogResult } from "@/lib/logs/contract";

export type LogFilters = { q: string; family: Family | "ALL"; category: LogCategoryFilter; actor: string; target: string; result: LogResult | "ALL"; from: Date | null; to: Date | null; page: number; pageSize: 25 | 50 };
export type LogFeedItem = { id: string; detailId: string; source: "audit" | "event"; category: LogCategoryFilter; action: string; summary: string; result: string | null; family: Family | null; actor: string | null; target: string | null; createdAt: Date; metadata: Record<string, unknown> | null };
export type LogDetail = LogFeedItem & { technical: Record<string, string | null> };

const pageSizes = new Set([25, 50]);
const auditCategory = (action: string): LogCategoryFilter => action.startsWith("ACCESS_") ? "ACCESS" : action.startsWith("APPLICATION_") ? "APPLICATION" : "SYSTEM";
const auditSummary: Record<string, string> = {
  PROFILE_CUSTOMIZATION_UPDATED: "Внешний вид профиля обновлён",
  PROFILE_CUSTOMIZATION_RESET: "Стандартный вид профиля восстановлен",
  FACTION_ROLE_GRANTED: "Роль фракции выдана",
  FACTION_ROLE_REMOVED: "Роль фракции снята",
  FACTION_ROLE_PANEL_PUBLISHED: "Панель ролей фракций опубликована",
  FACTION_ROLE_PANEL_UPDATED: "Панель ролей фракций обновлена",
  FACTION_ROLE_SETTINGS_UPDATED: "Настройки ролей фракций изменены",
  ...VACATION_ACTION_LABELS,
  ACCESS_REQUEST_CREATED: "Создан запрос на дополнительные права",
  ACCESS_REQUEST_APPROVED: "Запрос на дополнительные права одобрен",
  ACCESS_REQUEST_REJECTED: "Запрос на дополнительные права отклонён",
  APPLICATION_CALL_STARTED: "Заявка переведена на обзвон",
  APPLICATION_ACCEPTED: "Заявка принята",
  APPLICATION_REJECTED: "Заявка отклонена",
};
const asRecord = (value: Prisma.JsonValue | null): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const cleanText = (value: string | null | undefined): string | null => value?.trim() || null;

export function parseLogFilters(input: Record<string, string | string[] | undefined>): LogFilters {
  const value = (key: string) => typeof input[key] === "string" ? input[key]!.trim() : "";
  const family = value("family"); const category = value("category"); const result = value("result");
  const date = (key: string, end = false) => { const raw = value(key); if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null; const parsed = new Date(`${raw}T${end ? "23:59:59.999" : "00:00:00.000"}Z`); return Number.isNaN(parsed.valueOf()) ? null : parsed; };
  const page = Math.max(1, Math.min(Number.parseInt(value("page"), 10) || 1, 100)); const size = Number.parseInt(value("size"), 10);
  return { q: value("q").slice(0, 100), family: family === "MEMPHIS" ? family : "ALL", category: LOG_CATEGORIES.includes(category as LogCategoryFilter) ? category as LogCategoryFilter : "ALL", actor: value("actor").slice(0, 100), target: value("target").slice(0, 100), result: ["SUCCESS", "FAILURE", "PENDING", "INFO"].includes(result) ? result as LogResult : "ALL", from: date("from"), to: date("to", true), page, pageSize: pageSizes.has(size) ? size as 25 | 50 : 25 };
}

function eventWhere(filters: LogFilters): Prisma.LogEventWhereInput {
  const and: Prisma.LogEventWhereInput[] = [];
  if (filters.category === "ACCESS") and.push({ id: "__no_matching_event_category__" });
  if (filters.family !== "ALL") and.push({ family: filters.family });
  if (filters.category !== "ALL" && filters.category !== "ACCESS") and.push({ category: filters.category });
  if (filters.result !== "ALL") and.push({ result: filters.result });
  if (filters.from || filters.to) and.push({ createdAt: { gte: filters.from ?? undefined, lte: filters.to ?? undefined } });
  if (filters.actor) and.push({ OR: [{ actorDiscordId: { contains: filters.actor, mode: "insensitive" } }, { actorUsername: { contains: filters.actor, mode: "insensitive" } }, { actorDisplayName: { contains: filters.actor, mode: "insensitive" } }] });
  if (filters.target) and.push({ OR: [{ targetDiscordId: { contains: filters.target, mode: "insensitive" } }, { targetUsername: { contains: filters.target, mode: "insensitive" } }, { targetDisplayName: { contains: filters.target, mode: "insensitive" } }] });
  if (filters.q) and.push({ OR: [{ sourceEventId: { contains: filters.q, mode: "insensitive" } }, { action: { contains: filters.q, mode: "insensitive" } }, { summary: { contains: filters.q, mode: "insensitive" } }, { actorDiscordId: { contains: filters.q, mode: "insensitive" } }, { targetDiscordId: { contains: filters.q, mode: "insensitive" } }, { actorDisplayName: { contains: filters.q, mode: "insensitive" } }, { targetDisplayName: { contains: filters.q, mode: "insensitive" } }] });
  return and.length ? { AND: and } : {};
}

function auditWhere(filters: LogFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (filters.category === "ACCESS") and.push({ action: { startsWith: "ACCESS_" } });
  else if (filters.category === "APPLICATION") and.push({ action: { startsWith: "APPLICATION_" } });
  else if (filters.category !== "ALL") and.push({ id: "__no_matching_audit_category__" });
  if (filters.from || filters.to) and.push({ createdAt: { gte: filters.from ?? undefined, lte: filters.to ?? undefined } });
  if (filters.actor) and.push({ actor: { is: { OR: [{ discordId: { contains: filters.actor, mode: "insensitive" } }, { username: { contains: filters.actor, mode: "insensitive" } }, { displayName: { contains: filters.actor, mode: "insensitive" } }] } } });
  if (filters.q) and.push({ OR: [{ action: { contains: filters.q, mode: "insensitive" } }, { targetId: { contains: filters.q, mode: "insensitive" } }, { actor: { is: { OR: [{ discordId: { contains: filters.q, mode: "insensitive" } }, { username: { contains: filters.q, mode: "insensitive" } }, { displayName: { contains: filters.q, mode: "insensitive" } }] } } }] });
  return and.length ? { AND: and } : {};
}

function eventItem(event: LogEvent): LogFeedItem {
  const actor = cleanText(event.actorDisplayName) ?? cleanText(event.actorUsername) ?? cleanText(event.actorDiscordId);
  const target = cleanText(event.targetDisplayName) ?? cleanText(event.targetUsername) ?? cleanText(event.targetDiscordId);
  const dynamicMembershipSummary = event.type === "MEMBER_JOINED" || event.type === "MEMBER_LEFT";
  return { id: event.id, detailId: `event_${event.id}`, source: "event", category: event.category, action: event.action, summary: dynamicMembershipSummary ? event.summary : VACATION_ACTION_LABELS[event.action] ?? event.summary, result: event.result, family: event.family, actor, target, createdAt: event.createdAt, metadata: asRecord(event.metadata) };
}

function auditItem(audit: AuditLog & { actor: { displayName: string; username: string; discordId: string } | null }): LogFeedItem {
  const metadata = asRecord(audit.metadata); const family = metadata?.family === "MEMPHIS" ? metadata.family : null;
  return { id: audit.id, detailId: `audit_${audit.id}`, source: "audit", category: auditCategory(audit.action), action: audit.action, summary: auditSummary[audit.action] ?? "Событие сайта", result: null, family, actor: audit.actor ? audit.actor.displayName || audit.actor.username : null, target: audit.targetId, createdAt: audit.createdAt, metadata };
}

function passesLocalFilters(item: LogFeedItem, filters: LogFilters): boolean {
  if (filters.family !== "ALL" && item.family !== filters.family) return false;
  if (filters.target && !(item.target ?? "").toLocaleLowerCase().includes(filters.target.toLocaleLowerCase())) return false;
  return true;
}

/** Queries both authorized server-side sources; the browser only receives a paginated normalized page. */
export type LogJournal = "SITE" | "DISCORD";

export async function getLogFeed(filters: LogFilters, journal: LogJournal | "ALL" = "ALL") {
  const candidateTake = Math.min(filters.page * filters.pageSize + 1, 501);
  const [events, audits] = await Promise.all([
    journal === "SITE" ? Promise.resolve([] as LogEvent[]) : prisma.logEvent.findMany({ where: eventWhere(filters), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: candidateTake }),
    journal === "DISCORD" ? Promise.resolve([] as AuditLog[]) : prisma.auditLog.findMany({ where: auditWhere(filters), include: { actor: { select: { displayName: true, username: true, discordId: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: candidateTake }),
  ]);
  const merged = [...events.map(eventItem), ...audits.map(auditItem)].filter((item) => passesLocalFilters(item, filters)).sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf() || b.id.localeCompare(a.id));
  const offset = (filters.page - 1) * filters.pageSize;
  return { items: merged.slice(offset, offset + filters.pageSize), hasNextPage: merged.length > offset + filters.pageSize, hasPreviousPage: filters.page > 1 };
}

export async function getLogDetail(detailId: string): Promise<LogDetail | null> {
  const match = /^(audit|event)_([a-zA-Z0-9_-]{1,64})$/.exec(detailId); if (!match) return null;
  if (match[1] === "event") { const event = await prisma.logEvent.findUnique({ where: { id: match[2] } }); if (!event) return null; const item = eventItem(event); return { ...item, technical: { "Источник": event.source, "Source event ID": event.sourceEventId, "Discord channel ID": event.discordChannelId, "Discord message ID": event.discordMessageId } }; }
  const audit = await prisma.auditLog.findUnique({ where: { id: match[2] }, include: { actor: { select: { displayName: true, username: true, discordId: true } } } }); if (!audit) return null; const item = auditItem(audit); return { ...item, technical: { "Источник": "WEBSITE_AUDIT", "Target type": audit.targetType, "Target ID": audit.targetId } };
}

export function safeMetadataEntries(metadata: Record<string, unknown> | null): Array<[string, string]> {
  if (!metadata) return [];
  const labels: Record<string, string> = { serverName: "Discord-сервер", wasOnServerBefore: "Раньше уже был на сервере (по журналу)" };
  return Object.entries(metadata).filter(([key]) => !/(token|secret|password|authorization|cookie)/i.test(key)).map(([key, value]) => [labels[key] ?? key, key === "wasOnServerBefore" ? value ? "Да" : "Нет" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value)]);
}
