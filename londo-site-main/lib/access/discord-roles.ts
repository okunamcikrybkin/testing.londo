import type { UserRole } from "@/lib/permissions/rbac";
import { getDiscordMemberRoleIds } from "@/lib/discord/client";

export type RequestableStaffRole = "RECRUIT" | "HIGH_STAFF";

function configuredRoleIds(name: "DISCORD_RECRUIT_ROLE_IDS" | "DISCORD_HIGH_STAFF_ROLE_IDS"): string[] {
  return (process.env[name] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

export function getEligibleStaffRole(roleIds: readonly string[]): RequestableStaffRole | null {
  const roleSet = new Set(roleIds);
  if (configuredRoleIds("DISCORD_HIGH_STAFF_ROLE_IDS").some((id) => roleSet.has(id))) return "HIGH_STAFF";
  return configuredRoleIds("DISCORD_RECRUIT_ROLE_IDS").some((id) => roleSet.has(id)) ? "RECRUIT" : null;
}

export async function getDiscordEligibleStaffRole(discordUserId: string): Promise<RequestableStaffRole | null> {
  return getEligibleStaffRole(await getDiscordMemberRoleIds(discordUserId));
}

export function canRequestRole(role: UserRole): role is RequestableStaffRole {
  return role === "RECRUIT" || role === "HIGH_STAFF";
}
