import type { UserRole } from "@/lib/permissions/rbac";
import { getDiscordMemberRoleIds } from "@/lib/discord/client";

export type RequestableStaffRole = "RECRUIT" | "HIGH_STAFF" | "DEP_OWNER";

export function configuredRoleIds(name: "DISCORD_RECRUIT_ROLE_IDS" | "DISCORD_HIGH_STAFF_ROLE_IDS"): string[] {
  return (process.env[name] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

export function getEligibleStaffRole(roleIds: readonly string[]): RequestableStaffRole | null {
  const roleSet = new Set(roleIds);
  const deputyOwnerRoleId = process.env.MEMPHIS_DEP_OWNER_ROLE_ID?.trim();
  if (deputyOwnerRoleId && roleSet.has(deputyOwnerRoleId)) return "DEP_OWNER";
  const highStaffRoleId = process.env.MEMPHIS_HIGH_STAFF_ROLE_ID?.trim();
  if (highStaffRoleId && roleSet.has(highStaffRoleId)) return "HIGH_STAFF";
  if (configuredRoleIds("DISCORD_HIGH_STAFF_ROLE_IDS").some((id) => roleSet.has(id))) return "HIGH_STAFF";
  return configuredRoleIds("DISCORD_RECRUIT_ROLE_IDS").some((id) => roleSet.has(id)) ? "RECRUIT" : null;
}

export async function getDiscordEligibleStaffRole(discordUserId: string): Promise<RequestableStaffRole | null> {
  return getEligibleStaffRole(await getDiscordMemberRoleIds(discordUserId));
}

export function canRequestRole(role: UserRole): role is RequestableStaffRole {
  return role === "RECRUIT" || role === "HIGH_STAFF" || role === "DEP_OWNER";
}
