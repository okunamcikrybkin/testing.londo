import { canAccessAllFamilies, getEffectiveAccess, hasMinimumAccess, type UserRole } from "@/lib/permissions/rbac";
import { canUseFeature } from "@/lib/permissions/features";
export { canAccessAllFamilies as canChooseAllFamilySpaces } from "@/lib/permissions/rbac";
export function canAccessFamilySpace(user: { discordId: string; role: UserRole; familyAccess?: { MEMPHIS: UserRole; PHOENIX: UserRole } }, family: "MEMPHIS") {
  if (family !== "MEMPHIS") return false;
  const access = getEffectiveAccess(user);
  if (canAccessAllFamilies(access)) return true;
  return canUseFeature(access, "dashboard") && hasMinimumAccess(user.familyAccess?.[family] ?? "USER", "RECRUIT");
}
