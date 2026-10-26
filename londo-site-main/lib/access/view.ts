import { prisma } from "@/lib/db/prisma";
import { canUseFeature } from "@/lib/permissions/features";
import type { SessionUser } from "@/lib/auth/session";
const accessReasonLabels: Record<string, string> = { MANUAL_REVOKE: "Доступ отозван вручную", ACCESS_REVOKED_DISCORD_ELIGIBILITY: "Пользователь больше не соответствует требованиям Discord", ACCESS_DOWNGRADED_DISCORD: "Доступ изменён после проверки ролей Discord" };
export async function accessPageData(user: SessionUser) {
  const [snapshot, grant, requests] = await Promise.all([
    prisma.userAccessSnapshot.findUnique({ where: { userId: user.id } }),
    prisma.staffAccessGrant.findFirst({ where: { userId: user.id, revokedAt: null } }),
    prisma.staffAccessRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const manager = canUseFeature(user.effectiveAccess,"accessManagement");
  const safeUser = { id: true, discordId: true, displayName: true, username: true, avatar: true, staffAccessCredential: { select: { pinSetAt: true } } } as const;
  const pending = manager ? await prisma.staffAccessRequest.findMany({ where: { status: "PENDING" }, include: { user: { select: safeUser } }, orderBy: { createdAt: "asc" } }) : [];
  const active = manager ? await prisma.staffAccessGrant.findMany({ where: { revokedAt: null }, include: { user: { select: safeUser } }, orderBy: { grantedAt: "desc" } }) : [];
  const history = manager ? await prisma.staffAccessGrant.findMany({ where: { revokedAt: { not: null } }, include: { user: { select: safeUser } }, orderBy: { revokedAt: "desc" }, take: 100 }) : [];
  const reviewed = manager ? await prisma.staffAccessRequest.findMany({ where: { status: { not: "PENDING" } }, include: { user: { select: safeUser } }, orderBy: { updatedAt: "desc" }, take: 100 }) : [];
  const ids = [...new Set([...active, ...history].flatMap(g => [g.grantedByUserId, g.revokedByUserId]).concat(reviewed.map(r => r.reviewedByUserId)).filter((id): id is string => Boolean(id)))];
  const actors = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } }) : [];
  return { snapshot, grant, requests, manager, pending, active, history: history.map(item => ({ ...item, revokeReason: item.revokeReason ? accessReasonLabels[item.revokeReason] ?? (item.revokeReason.includes("_") ? "Изменение доступа по системной проверке" : item.revokeReason) : item.revokeReason })), reviewed, actors: Object.fromEntries(actors.map(actor => [actor.id, actor.displayName])) };
}
