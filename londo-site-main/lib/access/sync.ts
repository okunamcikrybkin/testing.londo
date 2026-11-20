import { prisma } from "@/lib/db/prisma";
import { getEffectiveAccess } from "@/lib/permissions/rbac";
import { hasRecruitCuratorRole, resolveDiscordAccess } from "./resolver";
import { parseAccessObservation, type AccessObservation } from "./protocol";
import { ROLE_ORDER } from "./policy";
import { invalidateStaffSessions, lockAccess, restrictGrant } from "./store";

/** Discord observations update eligibility; only a top-ranked curator role grants access automatically. */
export async function syncDiscordAccess(input: AccessObservation) {
  const observation = parseAccessObservation(input);
  return prisma.$transaction(async tx => {
    await lockAccess(tx, [observation.discordId]);
    const user = await tx.user.findUnique({ where: { discordId: observation.discordId }, include: { accessSnapshot: true, staffAccessGrants: { where: { revokedAt: null } } } });
    if (!user) return { status: "UNKNOWN_USER" };
    if (getEffectiveAccess(user) === "FULL_ACCESS") return { status: "FULL_ACCESS" };
    const observedAt = new Date(observation.observedAt);
    if (user.accessSnapshot && user.accessSnapshot.observedAt >= observedAt) return { status: "STALE_OR_DUPLICATE" };
    const { familyAccess } = resolveDiscordAccess(observation.roleIds);
    const state = { observedAt, memphisRole: familyAccess.MEMPHIS, phoenixRole: familyAccess.PHOENIX, roleIds: observation.roleIds };
    await tx.userAccessSnapshot.upsert({ where: { userId: user.id }, create: { userId: user.id, ...state }, update: state });
    const curatorPresent = hasRecruitCuratorRole(observation.roleIds);
    let activeGrant: (typeof user.staffAccessGrants)[number] | undefined = user.staffAccessGrants[0];
    let curatorAccessChanged = false;
    let curatorGrantRemoved = false;

    const activeRole = activeGrant && ROLE_ORDER[activeGrant.role] > ROLE_ORDER[user.role] ? activeGrant.role : user.role;
    if (curatorPresent && familyAccess.MEMPHIS === "CURATOR" && activeRole !== "OWNER" && ROLE_ORDER[activeRole] <= ROLE_ORDER.CURATOR) {
      if (user.role !== "CURATOR") {
        await tx.user.update({ where: { id: user.id }, data: { role: "CURATOR" } });
        await tx.auditLog.create({ data: { action: "ACCESS_CURATOR_ROLE_APPLIED", targetType: "User", targetId: user.id, metadata: { previousRole: user.role, trigger: observation.trigger } } });
        curatorAccessChanged = true;
      }
      if (!activeGrant) {
        activeGrant = await tx.staffAccessGrant.create({ data: { userId: user.id, role: "CURATOR", memphisRole: "CURATOR", phoenixRole: "USER" } });
        await tx.staffAccessCredential.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
        await tx.auditLog.create({ data: { action: "ACCESS_CURATOR_ROLE_GRANTED", targetType: "User", targetId: user.id, metadata: { trigger: observation.trigger } } });
        curatorAccessChanged = true;
      }
    } else if (curatorPresent && activeGrant && familyAccess.MEMPHIS !== "CURATOR" && ROLE_ORDER[familyAccess.MEMPHIS] >= ROLE_ORDER[activeGrant.role] && ROLE_ORDER[activeGrant.role] > ROLE_ORDER[user.role]) {
      await tx.user.update({ where: { id: user.id }, data: { role: activeGrant.role } });
      await tx.auditLog.create({ data: { action: "ACCESS_ROLE_RESTORED_HIERARCHY", targetType: "User", targetId: user.id, metadata: { previousRole: user.role, restoredRole: activeGrant.role, trigger: observation.trigger } } });
      curatorAccessChanged = true;
    } else if (!curatorPresent && user.role === "CURATOR") {
      if (activeGrant?.role === "CURATOR" && !activeGrant.sourceRequestId && !activeGrant.grantedByUserId) {
        await tx.staffAccessGrant.update({ where: { id: activeGrant.id }, data: { revokedAt: new Date(), revokeReason: "DISCORD_CURATOR_ROLE_REMOVED" } });
        activeGrant = undefined;
        curatorGrantRemoved = true;
        await invalidateStaffSessions(tx, user.id);
      }
      const restoredRole = activeGrant?.role ?? "USER";
      await tx.user.update({ where: { id: user.id }, data: { role: restoredRole } });
      await tx.auditLog.create({ data: { action: "ACCESS_CURATOR_ROLE_REMOVED", targetType: "User", targetId: user.id, metadata: { restoredRole, trigger: observation.trigger } } });
      curatorAccessChanged = true;
    }

    const restricted = activeGrant ? await restrictGrant(tx, user.id, activeGrant, state, observation.trigger) : false;
    return { status: restricted ? "RESTRICTED" : curatorGrantRemoved ? "CURATOR_ACCESS_REVOKED" : curatorAccessChanged ? "CURATOR_ACCESS_UPDATED" : "ELIGIBILITY_UPDATED" };
  });
}
export async function refreshDiscordEligibility(discordId: string): Promise<void> {
  const base = process.env.LONDO_BOT_INTERNAL_URL, secret = process.env.LONDO_BOT_API_SECRET;
  if (!base || !secret) throw new Error("DISCORD_UNAVAILABLE");
  const result = await fetch(new URL("/internal/discord/access/member", base), {
    method: "POST", headers: { "content-type": "application/json", "x-londo-bot-secret": secret },
    body: JSON.stringify({ discordId }), cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  if (!result.ok) throw new Error("DISCORD_UNAVAILABLE");
  const observation = parseAccessObservation(await result.json());
  if (observation.discordId !== discordId || observation.trigger !== "OAUTH") throw new Error("INVALID_OBSERVATION");
  await syncDiscordAccess(observation);
}
export async function syncAccessOnLogin(discordId: string): Promise<void> {
  try { await refreshDiscordEligibility(discordId); }
  catch { console.warn("[ACCESS] Eligibility refresh unavailable; reconciliation will retry."); }
}
