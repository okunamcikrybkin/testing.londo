import type { Family } from "@prisma/client";
import type { SessionUser } from "../auth/session";
import { meetsAccess } from "../permissions/features";

export function canEditFamilyApplication(user: Pick<SessionUser, "effectiveAccess" | "pinVerified" | "familyAccess"> | null, family: Family): boolean {
  if (!user) return false;
  if (user.effectiveAccess === "FULL_ACCESS") return true;
  return user.pinVerified === true && meetsAccess(user.effectiveAccess, "RECRUIT") && meetsAccess(user.familyAccess?.[family] ?? "USER", "RECRUIT");
}

export const applicationAnswerLabels = {
  gameNicknameStatic: "Игровой никнейм / статик",
  oocAge: "OOC возраст",
  joinReason: "Причина вступления",
  discoverySource: "Откуда узнал о семье",
  charactersScreenshotUrl: "Ссылка на скриншот персонажей",
} as const;

export function isEditableApplicationStatus(status: string): boolean {
  return status === "NEW" || status === "CALL";
}
