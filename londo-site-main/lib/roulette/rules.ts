import {canUseFeature} from "../permissions/features";
export type Actor = { id: string; discordId: string; effectiveAccess: string; status: string };
export class RouletteError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function requirePlayer(user: Actor | null): asserts user is Actor {
  if (!user || user.status !== "ACTIVE") throw new RouletteError("UNAUTHORIZED", "Войдите в аккаунт.", 401);
  if (!canUseFeature(user.effectiveAccess,"roulette")) throw new RouletteError("FORBIDDEN","Рулетка доступна участникам семьи с уровнем FAMQ и выше.",403);
}
export function canManage(user: Actor | null) { return Boolean(user?.status === "ACTIVE" && canUseFeature(user.effectiveAccess,"rouletteAdmin")); }
export function requireAdmin(user: Actor | null): asserts user is Actor {
  requirePlayer(user);
  if (!canManage(user)) throw new RouletteError("FORBIDDEN", "Недостаточно прав.", 403);
}
export function historyScope(user: Actor | null, admin = false) {
  if (admin) requireAdmin(user); else requirePlayer(user);
  return admin ? {} : { userId: user.id };
}
function integer(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new RouletteError("INVALID_INPUT", "Проверьте числовые поля.");
  return value;
}
function text(value: unknown, max: number, required = false) {
  if (value !== null && value !== undefined && typeof value !== "string") throw new RouletteError("INVALID_INPUT", "Проверьте текстовые поля.");
  const s = ((value as string) || "").trim();
  if (s.length > max || (required && !s)) throw new RouletteError("INVALID_INPUT", "Заполните обязательные поля и проверьте длину текста.");
  return s;
}
function money(value: unknown, min = 0) {
  const s = typeof value === "number" || typeof value === "string" ? String(value) : "";
  if (!/^\d{1,10}(\.\d{1,4})?$/.test(s) || Number(s) < min || Number(s) > 1_000_000_000) throw new RouletteError("INVALID_INPUT", "Сумма должна быть от " + min + " до 1 000 000 000, до четырёх знаков после точки.");
  return s;
}
function boolean(value: unknown) { if (typeof value !== "boolean") throw new RouletteError("INVALID_INPUT", "Некорректное состояние."); return value; }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RouletteError("INVALID_INPUT", "Некорректный запрос.");
  return value as Record<string, unknown>;
}
export function spinInput(value: unknown) {
  const b = object(value);
  if (Object.keys(b).some(k => !["spinType", "requestId"].includes(k)) || !["FREE", "PAID"].includes(String(b.spinType)) || typeof b.requestId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(b.requestId)) throw new RouletteError("INVALID_INPUT", "Некорректный запрос вращения.");
  return { spinType: b.spinType as "FREE" | "PAID", requestId: b.requestId };
}
export function settingsInput(value: unknown) {
  const b = object(value);
  return { isEnabled: boolean(b.isEnabled), paidSpinPrice: money(b.paidSpinPrice), freeSpinCooldownHours: integer(b.freeSpinCooldownHours, 1, 8760) };
}
export function prizeInput(value: unknown) {
  const b = object(value), type = b.type;
  if (type !== "COINS" && type !== "DISCORD_ROLE" && type !== "MANUAL" && type !== "NOTHING") throw new RouletteError("INVALID_INPUT", "Неизвестный тип приза.");
  const role = type === "DISCORD_ROLE" ? text(b.discordRoleId, 20, true) : null;
  if (role && !/^\d{17,20}$/.test(role)) throw new RouletteError("INVALID_INPUT", "Выберите Discord роль.");
  return { name: text(b.name, 80, true), description: text(b.description, 1000) || null, type: type as "COINS" | "DISCORD_ROLE" | "MANUAL" | "NOTHING", weight: integer(b.weight, 1, 1_000_000), coinAmount: type === "COINS" ? money(b.coinAmount, 0.0001) : null, discordRoleId: role, manualText: type === "MANUAL" ? text(b.manualText, 1000, true) : null, isActive: boolean(b.isActive), sortOrder: integer(b.sortOrder, 0, 2_147_483_647) };
}
export function cooldownEnd(last: Date | null, hours: number) { return last ? new Date(+last + hours * 3600000) : null; }
