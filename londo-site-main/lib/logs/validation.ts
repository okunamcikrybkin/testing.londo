import type { Family, LogEventType } from "@prisma/client";
import { FAMILIES, LOG_EVENT_DEFINITIONS, LOG_RESULTS, type LogResult } from "@/lib/logs/contract";

export class LogEventInputError extends Error {}

export type BotLogEventInput = {
  sourceEventId: string;
  type: LogEventType;
  family: Family | null;
  serverId: string | null;
  actor: Identity | null;
  target: Identity | null;
  discordChannelId: string | null;
  discordMessageId: string | null;
  summary: string;
  result: LogResult | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date | null;
};
type Identity = { discordId: string; username: string | null; displayName: string | null };
const discordId = /^\d{16,22}$/;
const blockedKey = /(token|secret|password|authorization|cookie)/i;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, field: string, max: number, required = false): string | null {
  if (typeof value !== "string") {
    if (required) throw new LogEventInputError(`${field} is required.`);
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed && required) throw new LogEventInputError(`${field} is required.`);
  if (trimmed.length > max) throw new LogEventInputError(`${field} is too long.`);
  return trimmed || null;
}
function parseDiscordId(value: unknown, field: string): string | null {
  const parsed = text(value, field, 22);
  if (parsed && !discordId.test(parsed)) throw new LogEventInputError(`${field} is invalid.`);
  return parsed;
}
function identity(value: unknown, field: string): Identity | null {
  if (value === undefined || value === null) return null;
  const data = record(value);
  if (!data) throw new LogEventInputError(`${field} must be an object.`);
  const id = parseDiscordId(data.discordId, `${field}.discordId`);
  if (!id) throw new LogEventInputError(`${field}.discordId is required.`);
  return { discordId: id, username: text(data.username, `${field}.username`, 100), displayName: text(data.displayName, `${field}.displayName`, 100) };
}
function safeMetadata(value: unknown, depth = 0): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  const input = record(value);
  if (!input || depth > 2 || Object.keys(input).length > 20) throw new LogEventInputError("metadata is invalid.");
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(input)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key) || blockedKey.test(key)) throw new LogEventInputError("metadata contains a restricted key.");
    if (typeof item === "string") { if (item.length > 500) throw new LogEventInputError("metadata value is too long."); output[key] = item; }
    else if (typeof item === "number" || typeof item === "boolean" || item === null) output[key] = item;
    else if (Array.isArray(item)) { if (item.length > 20 || item.some((entry) => !["string", "number", "boolean"].includes(typeof entry) && entry !== null)) throw new LogEventInputError("metadata array is invalid."); output[key] = item; }
    else { const nested = safeMetadata(item, depth + 1); if (!nested) throw new LogEventInputError("metadata is invalid."); output[key] = nested; }
  }
  return output;
}

/** Validates the narrow bot-to-site contract and derives action/category server-side. */
export function parseBotLogEvent(payload: unknown): BotLogEventInput {
  const data = record(payload);
  if (!data) throw new LogEventInputError("Payload must be an object.");
  const type = text(data.type, "type", 64, true);
  if (!type || !(type in LOG_EVENT_DEFINITIONS)) throw new LogEventInputError("Unsupported event type.");
  const familyValue = text(data.family, "family", 20);
  if (familyValue && !FAMILIES.includes(familyValue as Family)) throw new LogEventInputError("family is invalid.");
  const resultValue = text(data.result, "result", 20);
  if (resultValue && !LOG_RESULTS.includes(resultValue as LogResult)) throw new LogEventInputError("result is invalid.");
  const occurredAtValue = text(data.occurredAt, "occurredAt", 40);
  const occurredAt = occurredAtValue ? new Date(occurredAtValue) : null;
  if (occurredAt && (Number.isNaN(occurredAt.valueOf()) || occurredAt > new Date(Date.now() + 5 * 60 * 1000))) throw new LogEventInputError("occurredAt is invalid.");
  const target = identity(data.target, "target");
  if ((type === "MEMBER_JOINED" || type === "MEMBER_LEFT") && !target) throw new LogEventInputError("target is required for membership events.");
  return { sourceEventId: text(data.sourceEventId, "sourceEventId", 128, true)!, type: type as LogEventType, family: familyValue as Family | null, serverId: parseDiscordId(data.serverId, "serverId"), actor: identity(data.actor, "actor"), target, discordChannelId: parseDiscordId(data.discordChannelId, "discordChannelId"), discordMessageId: parseDiscordId(data.discordMessageId, "discordMessageId"), summary: text(data.summary, "summary", 500, true)!, result: resultValue as LogResult | null, metadata: safeMetadata(data.metadata), occurredAt };
}
