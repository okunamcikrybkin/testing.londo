"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ApplicationStatus, Family } from "@prisma/client";
import { getApplicationStaffUser } from "@/lib/applications/access";
import type { ApplicationActionState } from "@/lib/applications/action-state";
import {
  acceptDiscordApplication,
  BotOperationError,
  createCallChannels,
  notifyDiscordApplication,
  rejectDiscordApplication,
} from "@/lib/applications/bot-client";
import { familyFromSlug, familySlug } from "@/lib/applications/families";
import { normalizeRejectionReason } from "@/lib/applications/rejection-reason";
import { prisma } from "@/lib/db/prisma";

type ApplicationIntent = "start-call" | "accept" | "reject";

function actionError(message: string): ApplicationActionState {
  return { message, ok: false };
}

function actionSuccess(message: string): ApplicationActionState {
  return { message, ok: true };
}

function parseFormValue(formData: FormData, key: string, maxLength = 100): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function parseMutationInput(formData: FormData): {
  family: Family;
  id: string;
  intent: ApplicationIntent;
  rejectionReason: string | null;
} | null {
  const id = parseFormValue(formData, "applicationId", 64);
  const familyValue = parseFormValue(formData, "family", 20);
  const intent = parseFormValue(formData, "intent", 20);
  const family = familyValue ? familyFromSlug(familyValue) : null;

  if (
    !id ||
    !family ||
    (intent !== "start-call" && intent !== "accept" && intent !== "reject")
  ) {
    return null;
  }

  return {
    family,
    id,
    intent,
    rejectionReason: parseFormValue(formData, "rejectionReason", 1000),
  };
}

async function sendApplicantNotification(
  application: Parameters<typeof notifyDiscordApplication>[0],
  reviewer: { id: string; discordId: string; displayName: string },
  type: "CALL" | "ACCEPTED" | "REJECTED",
): Promise<boolean> {
  try {
    return await notifyDiscordApplication(application, reviewer, type);
  } catch (error) {
    console.error(`[LONDO Applications] Failed to send ${type} DM for application ${application.id}.`, error);
    return false;
  }
}
function refreshApplicationPaths(family: Family, id: string): void {
  const slug = familySlug(family);
  revalidatePath("/applications");
  revalidatePath(`/applications/${slug}`);
  revalidatePath(`/applications/${slug}/${id}`);
}

async function acquireOperationLock(
  id: string,
  family: Family,
  statuses: ApplicationStatus[],
  operation: string,
  reviewerId: string,
): Promise<string | null> {
  const operationLock = `${operation}:${randomUUID()}`;
  const staleLockThreshold = new Date(Date.now() - 10 * 60 * 1000);
  const result = await prisma.familyApplication.updateMany({
    where: {
      family,
      id,
      status: { in: statuses },
      claimedByUserId: reviewerId,
      OR: [
        { operationLock: null },
        { operationLockedAt: { lt: staleLockThreshold } },
      ],
    },
    data: {
      operationLock,
      operationLockedAt: new Date(),
    },
  });

  return result.count === 1 ? operationLock : null;
}

async function releaseOperationLock(id: string, operationLock: string): Promise<void> {
  await prisma.familyApplication.updateMany({
    where: { id, operationLock },
    data: { operationLock: null, operationLockedAt: null },
  });
}

async function startCall(
  id: string,
  family: Family,
  reviewer: { id: string; discordId: string; displayName: string },
): Promise<ApplicationActionState> {
  const operationLock = await acquireOperationLock(id, family, ["NEW"], "start-call", reviewer.id);

  if (!operationLock) {
    return actionError("Заявка уже была обработана другим пользователем.");
  }

  let finalized = false;

  try {
    const application = await prisma.familyApplication.findFirst({
      where: { family, id, operationLock, status: "NEW" },
    });

    if (!application) {
      return actionError("Заявка уже была обработана другим пользователем.");
    }

    const createdChannels = await createCallChannels(application, reviewer);
    const saved = await prisma.$transaction(async (transaction) => {
      const result = await transaction.familyApplication.updateMany({
        where: { family, id, operationLock, status: "NEW" },
        data: {
          callStartedAt: new Date(),
          discordTextChannelId: createdChannels.textChannelId,
          discordVoiceChannelId: createdChannels.voiceChannelId,
          operationLock: null,
          operationLockedAt: null,
          reviewedByUserId: reviewer.id,
          status: "CALL",
        },
      });

      if (result.count !== 1) {
        return false;
      }

      await transaction.auditLog.create({
        data: {
          action: "APPLICATION_CALL_STARTED",
          actorId: reviewer.id,
          metadata: { family },
          targetId: id,
          targetType: "FamilyApplication",
        },
      });
      return true;
    });

    if (!saved) {
      return actionError("Заявка уже была обработана другим пользователем.");
    }

    finalized = true;
    refreshApplicationPaths(family, id);
    const dmSent = await sendApplicantNotification({ ...application, discordTextChannelId: createdChannels.textChannelId, discordVoiceChannelId: createdChannels.voiceChannelId }, reviewer, "CALL");
    return actionSuccess(dmSent ? "Каналы для обзвона созданы. Заявка переведена в статус CALL." : "Каналы созданы и заявка переведена на обзвон, но личное сообщение отправить не удалось.");
  } catch (error) {
    if (error instanceof BotOperationError) {
      return actionError(error.message);
    }

    return actionError("Не удалось начать обзвон. Статус заявки не изменён.");
  } finally {
    if (!finalized) {
      await releaseOperationLock(id, operationLock);
    }
  }
}

async function acceptApplication(
  id: string,
  family: Family,
  reviewer: { id: string; discordId: string; displayName: string },
): Promise<ApplicationActionState> {
  const operationLock = await acquireOperationLock(id, family, ["CALL"], "accept", reviewer.id);

  if (!operationLock) {
    return actionError("Заявка уже была обработана другим пользователем.");
  }

  let finalized = false;

  try {
    const application = await prisma.familyApplication.findFirst({
      where: { family, id, operationLock, status: "CALL" },
    });

    if (!application) {
      return actionError("Заявка уже была обработана другим пользователем.");
    }

    await acceptDiscordApplication(application);

    const saved = await prisma.$transaction(async (transaction) => {
      const result = await transaction.familyApplication.updateMany({
        where: { family, id, operationLock, status: "CALL" },
        data: {
          completedAt: new Date(),
          operationLock: null,
          operationLockedAt: null,
          reviewedByUserId: reviewer.id,
          claimedByUserId: null,
          claimedAt: null,
          status: "ACCEPTED",
        },
      });

      if (result.count !== 1) {
        return false;
      }

      await transaction.auditLog.create({
        data: {
          action: "APPLICATION_ACCEPTED",
          actorId: reviewer.id,
          metadata: { family },
          targetId: id,
          targetType: "FamilyApplication",
        },
      });
      return true;
    });

    if (!saved) {
      return actionError("Заявка уже была обработана другим пользователем.");
    }

    finalized = true;
    refreshApplicationPaths(family, id);
    const dmSent = await sendApplicantNotification(application, reviewer, "ACCEPTED");
    return actionSuccess(dmSent ? "Заявка принята, никнейм из анкеты установлен, Discord-роли выданы." : "Заявка принята, но личное сообщение отправить не удалось.");
  } catch (error) {
    if (error instanceof BotOperationError) {
      return actionError(error.message);
    }

    return actionError("Не удалось принять заявку. Статус не изменён.");
  } finally {
    if (!finalized) {
      await releaseOperationLock(id, operationLock);
    }
  }
}

async function rejectApplication(
  id: string,
  family: Family,
  reviewer: { id: string; discordId: string; displayName: string },
  rejectionReason: string | null,
): Promise<ApplicationActionState> {
  const normalizedReason = normalizeRejectionReason(rejectionReason);
  if (!normalizedReason) {
    return actionError("Укажите причину отклонения.");
  }

  const operationLock = await acquireOperationLock(id, family, ["NEW", "CALL"], "reject", reviewer.id);
  if (!operationLock) {
    return actionError("Заявка уже была обработана другим пользователем.");
  }
  let finalized = false;
  try {
    const application = await prisma.familyApplication.findFirst({ where: { family, id, operationLock, status: { in: ["NEW", "CALL"] } } });
    if (!application) return actionError("Заявка уже была обработана другим пользователем.");
    if (application.status === "CALL") await rejectDiscordApplication({ ...application, rejectionReason: normalizedReason });

    const saved = await prisma.$transaction(async (transaction) => {
      const result = await transaction.familyApplication.updateMany({
        where: { family, id, operationLock, status: { in: ["NEW", "CALL"] } },
        data: { completedAt: new Date(), rejectionReason: normalizedReason, reviewedByUserId: reviewer.id, claimedByUserId: null, claimedAt: null, status: "REJECTED", operationLock: null, operationLockedAt: null },
      });

      if (result.count !== 1) return false;

      await transaction.auditLog.create({ data: { action: "APPLICATION_REJECTED", actorId: reviewer.id, metadata: { family, rejectionReason: normalizedReason }, targetId: id, targetType: "FamilyApplication" } });
      return true;
    });

    if (!saved) return actionError("Заявка уже была обработана другим пользователем.");
    finalized = true;
    refreshApplicationPaths(family, id);
    const dmSent = await sendApplicantNotification({ ...application, rejectionReason: normalizedReason }, reviewer, "REJECTED");
    return actionSuccess(dmSent ? "Заявка отклонена и перенесена в историю." : "Заявка отклонена, но личное сообщение отправить не удалось.");
  } catch (error) {
    if (error instanceof BotOperationError) return actionError(error.message);
    return actionError("Не удалось отклонить заявку. Статус не изменён.");
  } finally {
    if (!finalized) await releaseOperationLock(id, operationLock);
  }
}

export async function mutateApplicationAction(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const input = parseMutationInput(formData);
  if (!input) {
    return actionError("Переданы некорректные данные заявки.");
  }

  const staffUser = await getApplicationStaffUser(input.family);
  if (!staffUser) {
    return actionError("Недостаточно прав для обработки заявок этой семьи.");
  }

  if (input.intent === "start-call") {
    return startCall(input.id, input.family, staffUser);
  }

  if (input.intent === "accept") {
    return acceptApplication(input.id, input.family, staffUser);
  }

  return rejectApplication(
    input.id,
    input.family,
    staffUser,
    input.rejectionReason,
  );
}
