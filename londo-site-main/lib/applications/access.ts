import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { canAccessAllFamilies, getEffectiveAccess } from "@/lib/permissions/rbac";
import type { Family } from "@prisma/client";
import { canEditFamilyApplication } from "./edit-policy";

export function canManageApplications(user: SessionUser, family?: Family): boolean {
  if (canAccessAllFamilies(getEffectiveAccess(user))) return true;
  if (family) return canEditFamilyApplication(user, family);
  return false;
}

export async function getApplicationStaffUser(family?: Family): Promise<SessionUser | null> {
  const user = await getCurrentUser();

  if (!user || !canManageApplications(user, family)) {
    return null;
  }

  return user;
}
