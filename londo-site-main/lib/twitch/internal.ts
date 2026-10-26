import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const DISCORD_ID = /^\d{17,20}$/;
const TWITCH_LOGIN = /^[a-z0-9][a-z0-9_]{2,24}$/;

export function botAuthorized(request: NextRequest): boolean {
  const expected = process.env.LONDO_BOT_API_SECRET;
  const received = request.headers.get("x-londo-bot-secret");
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${field} is required.`);
  const result = value.trim();
  if (!result || result.length > maxLength) throw new Error(`${field} is invalid.`);
  return result;
}

export function discordId(value: unknown, field = "discordUserId"): string {
  const result = requiredText(value, field, 20);
  if (!DISCORD_ID.test(result)) throw new Error(`${field} is invalid.`);
  return result;
}

export function twitchLogin(value: unknown): string {
  const result = requiredText(value, "twitchLogin", 25).toLowerCase();
  if (!TWITCH_LOGIN.test(result)) throw new Error("twitchLogin is invalid.");
  return result;
}

export function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  return requiredText(value, field, maxLength);
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Payload must be an object.");
  return value as Record<string, unknown>;
}
