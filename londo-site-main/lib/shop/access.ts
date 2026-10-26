import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { canUseFeature } from "@/lib/permissions/features";

export function canManageShop(user: SessionUser): boolean { return canUseFeature(user.effectiveAccess, "shopManage"); }
export async function getShopManager(): Promise<SessionUser | null> { const user = await getCurrentUser(); return user && canManageShop(user) ? user : null; }
