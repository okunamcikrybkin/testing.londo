import {canUseFeature} from "../permissions/features";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEffectiveAccess } from "@/lib/permissions/rbac";
import { canRequestScopes, emptyScopes, highestScope, intersectScopes, scopesEqual, validPin } from "./policy";
import { sessionStaffState } from "./session-policy";
import { hashPin, verifyPinHash } from "./pin-crypto";
import { refreshDiscordEligibility } from "./sync";
import { invalidateStaffSessions, lockAccess } from "./store";
import { shopBot } from "@/lib/shop/bot";

export class AccessError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const include = { user: { include: { accessSnapshot: true, staffAccessCredential: true, staffAccessGrants: { where: { revokedAt: null } } } } } satisfies Prisma.SessionInclude;
async function activeSession(tx: Prisma.TransactionClient, sessionId: string) {
  const session = await tx.session.findUnique({ where: { id: sessionId }, include });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") throw new AccessError("Войдите в аккаунт.", 401);
  return session;
}
async function transaction<T>(sessionId: string, targetId: string | null, run: (tx: Prisma.TransactionClient, session: Awaited<ReturnType<typeof activeSession>>) => Promise<T>) {
  return prisma.$transaction(async tx => {
    const initial = await activeSession(tx, sessionId);
    const target = targetId ? await tx.user.findUnique({ where: { id: targetId }, select: { discordId: true } }) : null;
    await lockAccess(tx, [initial.user.discordId, ...(target ? [target.discordId] : [])]);
    return run(tx, await activeSession(tx, sessionId));
  }, { timeout: 20_000 });
}
function manager(session: Awaited<ReturnType<typeof activeSession>>, fullOnly = false) {
  const full = getEffectiveAccess(session.user) === "FULL_ACCESS";
  const state = sessionStaffState(session, full);
  if (!full && (fullOnly || !canUseFeature(state.role, "accessManagement") || !state.pinVerified)) throw new AccessError("Недостаточно прав или не подтверждён защитный код.", 403);
}
async function fresh(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  if (!user) throw new AccessError("Пользователь не найден.", 404);
  try { await refreshDiscordEligibility(user.discordId); }
  catch { throw new AccessError("Не удалось проверить роли Discord. Попробуйте позже.", 503); }
}
async function notifyAccessBot(path: string, body: object) {
  try { await shopBot(path, body); }
  catch (error) { console.warn(`[ACCESS] Discord notification failed for ${path}.`, error); }
}
export async function createStaffRequest(sessionId: string) {
  const session = await activeSession(prisma, sessionId);
  if (getEffectiveAccess(session.user) === "FULL_ACCESS") throw new AccessError("Для администратора сайта запрос не требуется.");
  await fresh(session.userId);
  const outcome = await transaction(sessionId, null, async (tx, current) => {
    const eligible = current.user.accessSnapshot;
    if (!eligible || highestScope(eligible) === "USER" || !canRequestScopes(current.user.staffAccessGrants[0] ?? emptyScopes, eligible)) throw new AccessError("Нет доступного нового уровня или семейного доступа.");
    if (await tx.staffAccessRequest.findFirst({ where: { userId: current.userId, status: "PENDING" } })) throw new AccessError("У вас уже есть ожидающая заявка.", 409);
    const request = await tx.staffAccessRequest.create({ data: { userId: current.userId, requestedRole: highestScope(eligible), memphisRole: eligible.memphisRole, phoenixRole: eligible.phoenixRole, discordRoleIds: eligible.roleIds ?? [], status: "PENDING" } });
    await tx.auditLog.create({ data: { actorId: current.userId, action: "ACCESS_REQUEST_CREATED", targetType: "StaffAccessRequest", targetId: request.id, metadata: { requestedRole: request.requestedRole, memphisRole: request.memphisRole, phoenixRole: request.phoenixRole } } });
    return { message: "Запрос отправлен на рассмотрение.", notification: { requestId: request.id, discordId: current.user.discordId, displayName: current.user.displayName, username: current.user.username, requestedRole: request.requestedRole, memphisRole: request.memphisRole, phoenixRole: request.phoenixRole } };
  });
  await notifyAccessBot("/internal/discord/access/request", outcome.notification);
  return { message: outcome.message };
}
export async function reviewStaffRequest(sessionId: string, requestId: string, approve: boolean, reason?: string) {
  const initial = await activeSession(prisma, sessionId); manager(initial);
  const request = await prisma.staffAccessRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new AccessError("Запрос не найден.", 404);
  if (approve) await fresh(request.userId);
  if (!approve && (!reason || reason.trim().length < 3 || reason.trim().length > 1000)) throw new AccessError("Укажите причину отклонения: 3–1000 символов.");
  const outcome = await transaction(sessionId, request.userId, async (tx, actor) => {
    manager(actor);
    const pending = await tx.staffAccessRequest.findUnique({ where: { id: requestId } });
    if (!pending || pending.status !== "PENDING") throw new AccessError("Запрос уже обработан.", 409);
    const target = await tx.user.findUniqueOrThrow({ where: { id: pending.userId }, include: { accessSnapshot: true, staffAccessGrants: { where: { revokedAt: null } } } });
    if (getEffectiveAccess(target) === "FULL_ACCESS") throw new AccessError("Права администратора сайта нельзя изменить через заявку.", 403);
    if (approve) {
      const eligible = target.accessSnapshot ?? emptyScopes;
      const scopes = intersectScopes(pending, eligible);
      if (!scopesEqual(scopes, pending) || highestScope(scopes) !== pending.requestedRole || pending.requestedRole === "USER") throw new AccessError("Роли Discord изменились. Отклоните запрос; пользователь сможет подать новый.", 409);
      await tx.staffAccessGrant.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date(), revokedByUserId: actor.userId, revokeReason: "REPLACED_BY_APPROVAL" } });
      await tx.staffAccessGrant.create({ data: { userId: target.id, role: pending.requestedRole, ...scopes, sourceRequestId: pending.id, grantedByUserId: actor.userId } });
      await tx.user.update({ where: { id: target.id }, data: { role: pending.requestedRole } });
      await tx.staffAccessCredential.upsert({ where: { userId: target.id }, create: { userId: target.id }, update: {} });
    }
    await tx.staffAccessRequest.update({ where: { id: requestId }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedByUserId: actor.userId, reviewedAt: new Date(), rejectionReason: approve ? null : reason!.trim() } });
    await tx.auditLog.create({ data: { actorId: actor.userId, action: approve ? "ACCESS_REQUEST_APPROVED" : "ACCESS_REQUEST_REJECTED", targetType: "User", targetId: target.id, metadata: { requestId, requestedRole: pending.requestedRole, ...(approve ? {} : { reason: reason!.trim() }) } } });
    return { message: approve ? "Доступ одобрен. Пользователю нужно подтвердить PIN." : "Запрос отклонён.", notification: approve ? { discordId: target.discordId, displayName: target.displayName, username: target.username, requestedRole: pending.requestedRole, memphisRole: pending.memphisRole, phoenixRole: pending.phoenixRole } : null };
  });
  if (outcome.notification) await notifyAccessBot("/internal/discord/access/approved", outcome.notification);
  return { message: outcome.message };
}
export async function cancelStaffRequest(sessionId: string) {
  return transaction(sessionId, null, async (tx, actor) => {
    await tx.staffAccessRequest.updateMany({ where: { userId: actor.userId, status: "PENDING" }, data: { status: "CANCELLED" } });
    return { message: "Запрос отменён." };
  });
}
export async function revokeStaffAccess(sessionId: string, userId: string) {
  return transaction(sessionId, userId, async (tx, actor) => {
    manager(actor);
    const target = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (getEffectiveAccess(target) === "FULL_ACCESS") throw new AccessError("Права администратора сайта нельзя отозвать.", 403);
    const changed = await tx.staffAccessGrant.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedByUserId: actor.userId, revokeReason: "MANUAL_REVOKE" } });
    await tx.user.update({ where: { id: userId }, data: { role: "USER" } });
    await invalidateStaffSessions(tx, userId);
    await tx.staffAccessRequest.updateMany({ where: { userId, status: "PENDING" }, data: { status: "CANCELLED" } });
    if (changed.count) await tx.auditLog.create({ data: { actorId: actor.userId, action: "ACCESS_REVOKED", targetType: "User", targetId: userId } });
    return { message: "Доступ отозван во всех сессиях." };
  });
}
export async function resetStaffPin(sessionId: string, userId: string) {
  return transaction(sessionId, userId, async (tx, actor) => {
    manager(actor, true);
    if (!await tx.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new AccessError("Пользователь не найден.", 404);
    await tx.staffAccessCredential.upsert({ where: { userId }, create: { userId }, update: { pinHash: null, pinSetAt: null, failedAttempts: 0, lockedUntil: null, credentialVersion: { increment: 1 } } });
    await invalidateStaffSessions(tx, userId);
    await tx.auditLog.create({ data: { actorId: actor.userId, action: "STAFF_PIN_RESET", targetType: "User", targetId: userId } });
    return { message: "PIN сброшен. Пользователь должен настроить новый PIN." };
  });
}
export async function setupStaffPin(sessionId: string, pin: unknown, confirmation: unknown) {
  if (!validPin(pin) || pin !== confirmation) throw new AccessError("Введите ровно 4 цифры и одинаковое подтверждение.");
  return transaction(sessionId, null, async (tx, actor) => {
    if (!actor.user.staffAccessGrants.length) throw new AccessError("Сначала получите одобрение доступа.", 403);
    if (actor.user.staffAccessCredential?.pinHash) throw new AccessError("Защитный код уже настроен. Подтвердите его.", 409);
    const now = new Date(), pinHash = await hashPin(pin);
    const credential = await tx.staffAccessCredential.upsert({ where: { userId: actor.userId }, create: { userId: actor.userId, pinHash, pinSetAt: now }, update: { pinHash, pinSetAt: now, failedAttempts: 0, lockedUntil: null } });
    await tx.session.update({ where: { id: actor.id }, data: { staffPinVerifiedAt: now, staffPinCredentialVersion: credential.credentialVersion } });
    await tx.auditLog.create({ data: { actorId: actor.userId, action: "STAFF_PIN_SET", targetType: "User", targetId: actor.userId } });
    return { message: "PIN настроен. Доступ подтверждён." };
  });
}
export async function verifyStaffPin(sessionId: string, pin: unknown) {
  return transaction(sessionId, null, async (tx, actor) => {
    const credential = actor.user.staffAccessCredential;
    if (!actor.user.staffAccessGrants.length || !credential?.pinHash) throw new AccessError("Настройте защитный код после одобрения доступа.", 403);
    const now = new Date();
    if (credential.lockedUntil && credential.lockedUntil > now) return { error: "Слишком много попыток. Попробуйте через 15 минут.", status: 429 };
    if (!validPin(pin) || !await verifyPinHash(pin, credential.pinHash)) {
      const attempts = credential.lockedUntil ? 1 : credential.failedAttempts + 1;
      const locked = attempts >= 5;
      await tx.staffAccessCredential.update({ where: { userId: actor.userId }, data: { failedAttempts: attempts, lockedUntil: locked ? new Date(now.getTime() + 15 * 60_000) : null } });
      if (locked) await tx.auditLog.create({ data: { actorId: actor.userId, action: "STAFF_PIN_LOCKED", targetType: "User", targetId: actor.userId } });
      return { error: locked ? "Слишком много попыток. Попробуйте через 15 минут." : "Неверный PIN", status: locked ? 429 : 400 };
    }
    await tx.staffAccessCredential.update({ where: { userId: actor.userId }, data: { failedAttempts: 0, lockedUntil: null } });
    await tx.session.update({ where: { id: actor.id }, data: { staffPinVerifiedAt: now, staffPinCredentialVersion: credential.credentialVersion } });
    await tx.auditLog.create({ data: { actorId: actor.userId, action: "STAFF_PIN_VERIFIED", targetType: "User", targetId: actor.userId } });
    return { message: "Доступ подтверждён." };
  });
}
