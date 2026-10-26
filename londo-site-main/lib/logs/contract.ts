import type { Family, LogEventCategory, LogEventType } from "@prisma/client";

export const LOG_EVENT_DEFINITIONS = {
  APPLICATION_CREATED: { action: "APPLICATION_CREATED", category: "APPLICATION" },
  APPLICATION_CALL_STARTED: { action: "APPLICATION_CALL_STARTED", category: "APPLICATION" },
  APPLICATION_ACCEPTED: { action: "APPLICATION_ACCEPTED", category: "APPLICATION" },
  APPLICATION_REJECTED: { action: "APPLICATION_REJECTED", category: "APPLICATION" },
  RANK_CHANGED: { action: "RANK_CHANGED", category: "RANK" },
  ROSTER_RANK_CHANGED: { action: "ROSTER_RANK_CHANGED", category: "RANK" },
  PROMOTION_CREATED: { action: "PROMOTION_CREATED", category: "PROMOTION" },
  PROMOTION_ACCEPTED: { action: "PROMOTION_ACCEPTED", category: "PROMOTION" },
  PROMOTION_REJECTED: { action: "PROMOTION_REJECTED", category: "PROMOTION" },
  AFK_STARTED: { action: "AFK_STARTED", category: "AFK" },
  AFK_ENDED: { action: "AFK_ENDED", category: "AFK" },
  VACATION_STARTED: { action: "VACATION_STARTED", category: "VACATION" },
  VACATION_ENDED: { action: "VACATION_ENDED", category: "VACATION" },
  BALANCE_CHANGED: { action: "BALANCE_CHANGED", category: "BALANCE" },
  MEMBER_JOINED: { action: "MEMBER_JOINED", category: "MEMBERSHIP" },
  MEMBER_LEFT: { action: "MEMBER_LEFT", category: "MEMBERSHIP" },
  SYSTEM_EVENT: { action: "SYSTEM_EVENT", category: "SYSTEM" },
} as const satisfies Record<LogEventType, { action: string; category: LogEventCategory }>;

export const LOG_CATEGORIES = ["ALL", "APPLICATION", "ACCESS", "RANK", "PROMOTION", "AFK", "VACATION", "BALANCE", "MEMBERSHIP", "SYSTEM"] as const;
export type LogCategoryFilter = (typeof LOG_CATEGORIES)[number];
export const LOG_RESULTS = ["SUCCESS", "FAILURE", "PENDING", "INFO"] as const;
export type LogResult = (typeof LOG_RESULTS)[number];
export const FAMILIES: readonly Family[] = ["MEMPHIS"];

export function eventDefinition(type: LogEventType) {
  return LOG_EVENT_DEFINITIONS[type];
}

export function categoryLabel(category: LogCategoryFilter): string {
  return ({ ALL: "Все", APPLICATION: "Заявки", ACCESS: "Доступ", RANK: "Ранги", PROMOTION: "Повышения", AFK: "Отпуск", VACATION: "Отпуска", BALANCE: "Баланс", MEMBERSHIP: "Участники Discord", SYSTEM: "Система" } as const)[category];
}


export const VACATION_ACTION_LABELS: Record<string, string> = {
  AFK_APPLICATION_CREATED: "Заявка на отпуск отправлена",
  AFK_APPLICATION_APPROVED: "Заявка на отпуск одобрена",
  AFK_APPLICATION_REJECTED: "Заявка на отпуск отклонена",
  AFK_STARTED: "Отпуск начался",
  AFK_ENDED: "Отпуск завершён",
  AFK_ENDED_EARLY: "Отпуск завершён досрочно",
  AFK_ROLE_GRANTED: "Роль отпуска выдана",
  AFK_ROLE_REMOVED: "Роль отпуска снята",
  AFK_ROLE_GRANT_FAILED: "Не удалось выдать роль отпуска",
  MEMBER_JOINED: "Участник зашёл на Discord-сервер",
  MEMBER_LEFT: "Участник вышел с Discord-сервера",
};
export function logActionLabel(action: string): string { return VACATION_ACTION_LABELS[action] ?? action; }
