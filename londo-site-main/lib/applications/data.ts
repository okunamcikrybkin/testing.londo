import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ApplicationTab = "new" | "call" | "history";
type ActiveFamily = "MEMPHIS";

export function statusesForTab(tab: ApplicationTab): ApplicationStatus[] {
  if (tab === "new") {
    return ["NEW"];
  }

  if (tab === "call") {
    return ["CALL"];
  }

  return ["ACCEPTED", "REJECTED"];
}

export async function getFamilyApplicationCounts(family: ActiveFamily) {
  const [newCount, callCount] = await Promise.all([
    prisma.familyApplication.count({ where: { family, status: "NEW" } }),
    prisma.familyApplication.count({ where: { family, status: "CALL" } }),
  ]);

  return { callCount, newCount };
}

export async function listFamilyApplications(family: ActiveFamily, tab: ApplicationTab) {
  const applications = await prisma.familyApplication.findMany({
    where: {
      family,
      status: { in: statusesForTab(tab) },
    },
    include: {
      reviewedBy: {
        select: { displayName: true, username: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const claimantIds = [...new Set(applications.flatMap((application) => application.claimedByUserId ? [application.claimedByUserId] : []))];
  if (!claimantIds.length) return applications.map((application) => ({ ...application, claimedByName: null }));

  const claimants = await prisma.user.findMany({
    where: { id: { in: claimantIds } },
    select: { id: true, displayName: true, username: true },
  });
  const namesById = new Map(claimants.map((claimant) => [claimant.id, claimant.displayName || claimant.username]));

  return applications.map((application) => ({
    ...application,
    claimedByName: application.claimedByUserId ? namesById.get(application.claimedByUserId) ?? null : null,
  }));
}

export async function getFamilyApplication(id: string, family: ActiveFamily) {
  const application = await prisma.familyApplication.findFirst({
    where: { family, id },
    include: {
      reviewedBy: {
        select: { displayName: true, username: true },
      },
    },
  });
  if (!application) return application;
  if (!application.claimedByUserId) return { ...application, claimedBy: null };
  const claimedBy = await prisma.user.findUnique({ where: { id: application.claimedByUserId }, select: { displayName: true, username: true, discordId: true } });
  return { ...application, claimedBy };
}

export async function getApplicantApplicationHistory(discordUserId: string, currentApplicationId: string) {
  return prisma.familyApplication.findMany({
    where: {
      discordUserId,
      family: "MEMPHIS",
      id: { not: currentApplicationId },
      status: { in: ["ACCEPTED", "REJECTED"] },
    },
    include: {
      reviewedBy: {
        select: { displayName: true, username: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getApplicationAuditTrail(applicationId: string) {
  return prisma.auditLog.findMany({
    where: { targetId: applicationId, targetType: "FamilyApplication" },
    include: {
      actor: { select: { displayName: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
