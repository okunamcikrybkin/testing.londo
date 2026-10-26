import {featureForPage,FEATURE_ACCESS,meetsAccess} from "../permissions/features";
import type { UserRole } from "@/lib/permissions/rbac";
export const ROLE_ORDER: Record<UserRole, number> = { USER: 0, RECRUIT: 1, HIGH_STAFF: 2, OWNER: 3 };
export type Scopes = { memphisRole: UserRole; phoenixRole: UserRole };
export const emptyScopes: Scopes = { memphisRole: "USER", phoenixRole: "USER" };
export const lowerRole = (a: UserRole, b: UserRole): UserRole => ROLE_ORDER[a] <= ROLE_ORDER[b] ? a : b;
export const highestScope = (s: Scopes): UserRole => ROLE_ORDER[s.memphisRole] >= ROLE_ORDER[s.phoenixRole] ? s.memphisRole : s.phoenixRole;
export const intersectScopes = (a: Scopes, b: Scopes): Scopes => ({ memphisRole: lowerRole(a.memphisRole, b.memphisRole), phoenixRole: lowerRole(a.phoenixRole, b.phoenixRole) });
export const scopesEqual = (a: Scopes, b: Scopes) => a.memphisRole === b.memphisRole && a.phoenixRole === b.phoenixRole;
export const canRequestScopes = (granted: Scopes, eligible: Scopes) => ROLE_ORDER[eligible.memphisRole] > ROLE_ORDER[granted.memphisRole] || ROLE_ORDER[eligible.phoenixRole] > ROLE_ORDER[granted.phoenixRole];
export const validPin = (value: unknown): value is string => typeof value === "string" && /^\d{4}$/.test(value);
export function safeStaffNext(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return "/dashboard";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\x00-\x20]/.test(decoded)) return "/dashboard";
    const url = new URL(value, "https://londo.invalid");
    if (url.origin !== "https://londo.invalid" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/access/pin")) return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch { return "/dashboard"; }
}

export function isStaffPage(value: string): boolean {
  const path = value.split("?")[0];
  const feature=featureForPage(path);
  if(feature && meetsAccess(FEATURE_ACCESS[feature],"RECRUIT"))return true;
  return /^\/(memphis|phoenix|applications)(\/|$)/.test(path)
    || /^\/(promotions|roulette)\/admin(\/|$)/.test(path)
    || /^\/giveaways\/[^/]+/.test(path);
}
