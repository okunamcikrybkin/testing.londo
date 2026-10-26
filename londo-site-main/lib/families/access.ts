import { canAccessAllFamilies, getEffectiveAccess, hasMinimumAccess, type UserRole } from "@/lib/permissions/rbac";
export { canAccessAllFamilies as canChooseAllFamilySpaces } from "@/lib/permissions/rbac";
export function canAccessFamilySpace(user: { discordId: string; role: UserRole; familyAccess?: { MEMPHIS: UserRole; PHOENIX: UserRole } }, family: "MEMPHIS") {
  if (family !== "MEMPHIS") return false;
  if (canAccessAllFamilies(getEffectiveAccess(user))) return true;
  return hasMinimumAccess(user.familyAccess?.[family] ?? "USER", "RECRUIT");
}
