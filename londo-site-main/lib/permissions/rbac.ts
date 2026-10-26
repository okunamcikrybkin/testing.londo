import "server-only";
import {canUseFeature,meetsAccess} from "./features";

export const USER_ROLES = ["USER", "RECRUIT", "HIGH_STAFF", "OWNER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EFFECTIVE_ACCESS_LEVELS = ["USER", "FAMQ", "RECRUIT", "HIGH_STAFF", "OWNER", "FULL_ACCESS"] as const;
export type EffectiveAccess = (typeof EFFECTIVE_ACCESS_LEVELS)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PERMISSIONS = [
  "users.view",
  "users.manage",
  "users.ban",
  "users.roles",
  "logs.view",
  "settings.view",
  "settings.manage",
  "bot.manage",
  "admin.access",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

type AccessSubject = Pick<{ discordId: string; role: UserRole }, "discordId" | "role"> & {famqFamilies?: readonly string[]};

export const ACCESS_LABELS: Record<EffectiveAccess, string> = {
  USER: "Участник",
  FAMQ: "Участник семьи",
  RECRUIT: "Рекрутер",
  HIGH_STAFF: "Старший сотрудник",
  OWNER: "Владелец",
  FULL_ACCESS: "Администратор сайта",
};



const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;
const ROLE_PERMISSIONS: Record<EffectiveAccess, readonly Permission[]> = {
  USER: [],
  FAMQ: [],
  RECRUIT: ["admin.access", "users.view"],
  HIGH_STAFF: [
    "admin.access",
    "logs.view",
    "users.view",
    "users.manage",
    "users.ban",
    "users.roles",
    "settings.view",
    "settings.manage",
    "bot.manage",
  ],
  OWNER: ALL_PERMISSIONS,
  FULL_ACCESS: ALL_PERMISSIONS,
};

const MANAGEABLE_STAFF_ROLES: Record<EffectiveAccess, readonly UserRole[]> = {
  USER: [],
  FAMQ: [],
  RECRUIT: [],
  HIGH_STAFF: [],
  OWNER: ["RECRUIT", "HIGH_STAFF", "OWNER"],
  FULL_ACCESS: ["RECRUIT", "HIGH_STAFF", "OWNER"],
};

function configuredFullAccessDiscordIds(): Set<string> {
  return new Set(
    (process.env.FULL_ACCESS_DISCORD_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

/** Computes the server-side access level from the authenticated Discord identity. */
export function getEffectiveAccess(user: AccessSubject): EffectiveAccess {
  return configuredFullAccessDiscordIds().has(user.discordId) ? "FULL_ACCESS" : user.role === "USER" && user.famqFamilies?.length ? "FAMQ" : user.role;
}

export function hasMinimumAccess(access: EffectiveAccess, minimum: EffectiveAccess): boolean {
  return meetsAccess(access, minimum);
}

export function hasPermission(access: EffectiveAccess, permission: Permission): boolean {
  return ROLE_PERMISSIONS[access].includes(permission);
}

export function canAccessAllFamilies(access: EffectiveAccess): boolean {
  return hasMinimumAccess(access, "OWNER");
}

export function canRequestStaffAccess(access: EffectiveAccess): boolean {
  return access === "USER" || access === "FAMQ";
}

export function canManageRole(actorAccess: EffectiveAccess, targetRole: UserRole): boolean {
  return MANAGEABLE_STAFF_ROLES[actorAccess].includes(targetRole);
}

export function canReviewAccessRequest(actorAccess: EffectiveAccess, requestedRole: UserRole): boolean {
  return canManageRole(actorAccess, requestedRole);
}

export function getReviewableStaffRoles(access: EffectiveAccess): readonly UserRole[] {
  return MANAGEABLE_STAFF_ROLES[access];
}

export function canAccessAdminPanel(access: EffectiveAccess): boolean {
  return hasPermission(access, "admin.access");
}

/** Audit access uses the same registry as navigation and page guards. */
export function canViewLogs(access: EffectiveAccess): boolean {
  return canUseFeature(access, "logs");
}

export function isAccountRestricted(status: UserStatus): boolean {
  return status === "SUSPENDED" || status === "BANNED";
}
