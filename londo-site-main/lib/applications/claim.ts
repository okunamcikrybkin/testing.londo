import type { Family } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export class ApplicationClaimError extends Error {}

export async function claimFamilyApplication(id: string, family: Family, userId: string) {
  const application = await prisma.familyApplication.findFirst({ where: { id, family } });
  if (!application) throw new ApplicationClaimError("Заявка не найдена.");
  if (!["NEW", "CALL"].includes(application.status)) throw new ApplicationClaimError("Заявка уже завершена.");
  if (application.claimedByUserId && application.claimedByUserId !== userId) throw new ApplicationClaimError("Заявка уже закреплена за другим рекрутом.");
  if (application.claimedByUserId === userId) return application;

  const result = await prisma.familyApplication.updateMany({
    where: { id, family, status: { in: ["NEW", "CALL"] }, claimedByUserId: null },
    data: { claimedByUserId: userId, claimedAt: new Date() },
  });
  if (result.count !== 1) throw new ApplicationClaimError("Заявку уже забрал другой рекрут.");
  return prisma.familyApplication.findUniqueOrThrow({ where: { id } });
}

export async function claimApplicationFromDiscord(eventId: string, discordId: string) {
  const event = await prisma.auditLog.findFirst({ where: { id: eventId, action: { in: ["APPLICATION_CREATED", "PROMOTION_APPLICATION_CREATED", "AFK_APPLICATION_CREATED"] } } });
  if (!event?.targetId) throw new ApplicationClaimError("Заявка не найдена.");
  const user = await prisma.user.findUnique({ where: { discordId } });
  if (!user || user.status !== "ACTIVE" || !["RECRUIT", "HIGH_STAFF", "OWNER"].includes(user.role)) throw new ApplicationClaimError("У вас нет прав брать заявки.");
  const family = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) && "family" in event.metadata ? event.metadata.family : null;
  if (family !== "MEMPHIS") throw new ApplicationClaimError("Семья заявки не определена.");
  if (event.action === "APPLICATION_CREATED") {
    const application = await claimFamilyApplication(event.targetId, family, user.id);
    return { applicationId: application.id, family, path: `/applications/${family.toLowerCase()}/${application.id}`, reviewer: user.displayName };
  }

  if (event.action === "PROMOTION_APPLICATION_CREATED") {
    const result = await prisma.promotionApplication.updateMany({ where: { id: event.targetId, family, status: { in: ["PENDING", "APPROVING"] }, claimedByDiscordId: null }, data: { claimedByDiscordId: discordId, claimedAt: new Date() } });
    if (!result.count) throw new ApplicationClaimError("Заявка уже закреплена или завершена.");
    return { applicationId: event.targetId, family, path: `/${family.toLowerCase()}/promotions?application=${encodeURIComponent(event.targetId)}`, reviewer: user.displayName };
  }

  const result = await prisma.afkApplication.updateMany({ where: { id: event.targetId, family, status: { in: ["PENDING", "APPROVING"] }, claimedByDiscordId: null }, data: { claimedByDiscordId: discordId, claimedAt: new Date() } });
  if (!result.count) throw new ApplicationClaimError("Заявка уже закреплена или завершена.");
  return { applicationId: event.targetId, family, path: `/${family.toLowerCase()}/afk?tab=pending&user=${encodeURIComponent(discordId)}`, reviewer: user.displayName };
}
