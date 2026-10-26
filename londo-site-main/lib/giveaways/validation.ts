import type { GiveawayFamily, GiveawayStatus } from "@prisma/client";

const SNOWFLAKE = /^\d{17,20}$/;
const FAMILIES = ["MEMPHIS", "ALL"] as const;
const STATUSES = ["DRAFT", "SCHEDULED", "ACTIVE", "ENDED", "CANCELLED"] as const;

export type GiveawayInput = {
  description: string;
  discordChannelId: string;
  endsAt: Date;
  family: GiveawayFamily;
  imageUrl: string | null;
  mentionRoleId: string | null;
  prize: string;
  requiredRoleId: string | null;
  status: GiveawayStatus;
  winnerCount: number;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Некорректные данные розыгрыша.");
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${name}: требуется текст.`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name}: поле обязательно.`);
  if (trimmed.length > max) throw new Error(`${name}: превышена максимальная длина.`);
  return trimmed;
}

function optionalText(value: unknown, name: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredText(value, name, max);
}

function discordId(value: unknown, name: string, required = true): string | null {
  const text = required ? requiredText(value, name, 20) : optionalText(value, name, 20);
  if (!text) return null;
  if (!SNOWFLAKE.test(text)) throw new Error(`${name}: некорректный Discord ID.`);
  return text;
}

function imageUrl(value: unknown): string | null {
  const text = optionalText(value, "Картинка", 2_000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new Error("Картинка: укажите http/https URL.");
  }
}

export function parseGiveawayInput(value: unknown, options: { allowStatus?: boolean; requireFutureEnd?: boolean } = {}): GiveawayInput {
  const data = record(value);
  const family = requiredText(data.family, "Семья", 20);
  if (!FAMILIES.includes(family as (typeof FAMILIES)[number])) throw new Error("Семья: выберите MEMPHIS или ALL.");
  const endText = requiredText(data.endsAt, "Время окончания", 80);
  const endsAt = new Date(endText);
  if (Number.isNaN(endsAt.getTime())) throw new Error("Время окончания: некорректная дата.");
  if (options.requireFutureEnd !== false && endsAt <= new Date()) throw new Error("Время окончания должно быть в будущем.");
  const winnerCount = data.winnerCount;
  if (!Number.isInteger(winnerCount) || typeof winnerCount !== "number" || winnerCount < 1 || winnerCount > 20) throw new Error("Количество победителей: от 1 до 20.");
  const statusText = options.allowStatus && typeof data.status === "string" ? data.status : "DRAFT";
  if (!STATUSES.includes(statusText as GiveawayStatus) || statusText === "ACTIVE" || statusText === "ENDED" || statusText === "CANCELLED") throw new Error("Некорректный статус розыгрыша.");
  const mentionMode = optionalText(data.mentionMode, "Пинг", 20) ?? "NONE";
  if (!["NONE", "FAM", "CUSTOM_ROLE"].includes(mentionMode)) throw new Error("Некорректный режим пинга.");
  // Only CUSTOM_ROLE consumes a user-supplied role id. FAM is resolved by the bot.
  const customRole = mentionMode === "CUSTOM_ROLE" ? discordId(data.mentionRoleId, "Роль для пинга") : null;

  return {
    description: requiredText(data.description, "Условия", 2_000),
    discordChannelId: discordId(data.discordChannelId, "Discord канал")!,
    endsAt,
    family: family as GiveawayFamily,
    imageUrl: imageUrl(data.imageUrl),
    mentionRoleId: mentionMode === "CUSTOM_ROLE" ? customRole : mentionMode === "FAM" ? "FAM" : null,
    prize: requiredText(data.prize, "Приз", 200),
    requiredRoleId: discordId(data.requiredRoleId, "Обязательная роль", false),
    status: statusText as GiveawayStatus,
    winnerCount,
  };
}

export function isDiscordSnowflake(value: unknown): value is string {
  return typeof value === "string" && SNOWFLAKE.test(value);
}

/** Clears stale custom role form values whenever a non-custom ping mode is chosen. */
export function mentionRoleFormValue(mode: "NONE" | "FAM" | "CUSTOM_ROLE", value: FormDataEntryValue | undefined): FormDataEntryValue | "" {
  return mode === "CUSTOM_ROLE" ? value ?? "" : "";
}
