import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { canUseFeature } from "@/lib/permissions/features";

/** Giveaway management uses the centralized HIGH_STAFF feature policy. */
export function canManageGiveaways(user: SessionUser): boolean {
  return canUseFeature(user.effectiveAccess, "giveaways");
}

export async function getGiveawayManager(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user && canManageGiveaways(user) ? user : null;
}
