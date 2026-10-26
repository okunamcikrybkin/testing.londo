import type { Prisma, StaffAccessGrant } from "@prisma/client";
import { emptyScopes, highestScope, intersectScopes, scopesEqual, type Scopes } from "./policy";
export async function lockAccess(tx: Prisma.TransactionClient, discordIds: string[]) {
  for (const id of [...new Set(discordIds)].sort()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
}
export async function invalidateStaffSessions(tx: Prisma.TransactionClient, userId: string) {
  await tx.session.updateMany({ where: { userId }, data: { staffPinVerifiedAt: null, staffPinCredentialVersion: null } });
}
export async function restrictGrant(tx: Prisma.TransactionClient, userId: string, grant: StaffAccessGrant | undefined, eligible: Scopes, trigger: string) {
  if (!grant) return false;
  const next = intersectScopes(grant, eligible), role = highestScope(next);
  if (scopesEqual(grant, next) && role === grant.role) return false;
  const action = role === "USER" ? "ACCESS_REVOKED_DISCORD_ELIGIBILITY" : "ACCESS_DOWNGRADED_DISCORD";
  await tx.staffAccessGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date(), revokeReason: action } });
  if (role !== "USER") await tx.staffAccessGrant.create({ data: { userId, role, ...next, sourceRequestId: grant.sourceRequestId, grantedByUserId: grant.grantedByUserId, grantedAt: grant.grantedAt } });
  await tx.user.update({ where: { id: userId }, data: { role } });
  await invalidateStaffSessions(tx, userId);
  await tx.auditLog.create({ data: { action, targetType: "User", targetId: userId, metadata: { previousRole: grant.role, newRole: role, previousScopes: { memphisRole: grant.memphisRole, phoenixRole: grant.phoenixRole }, scopes: next ?? emptyScopes, trigger } } });
  return true;
}
