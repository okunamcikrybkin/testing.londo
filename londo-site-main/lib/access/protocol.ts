import { timingSafeEqual } from "node:crypto";
export const ACCESS_TRIGGERS = ["ROLE_UPDATE", "STARTUP_RECONCILIATION", "PERIODIC_RECONCILIATION", "OAUTH"] as const;
export type AccessObservation = { discordId: string; roleIds: string[]; observedAt: string; trigger: typeof ACCESS_TRIGGERS[number] };
const idPattern = /^\d{17,20}$/;
export function accessSyncAuthorized(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function parseAccessObservation(value: unknown, now = Date.now()): AccessObservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_OBSERVATION");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => !["discordId", "roleIds", "observedAt", "trigger"].includes(key)) ||
      typeof v.discordId !== "string" || !idPattern.test(v.discordId) ||
      !Array.isArray(v.roleIds) || v.roleIds.length > 250 || v.roleIds.some(id => typeof id !== "string" || !idPattern.test(id)) ||
      typeof v.observedAt !== "string" || !Number.isFinite(Date.parse(v.observedAt)) ||
      Date.parse(v.observedAt) > now + 5_000 || Date.parse(v.observedAt) < now - 120_000 ||
      !ACCESS_TRIGGERS.includes(v.trigger as AccessObservation["trigger"])) throw new Error("INVALID_OR_STALE_OBSERVATION");
  return v as AccessObservation;
}
