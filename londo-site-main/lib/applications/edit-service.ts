import type { Family, Prisma } from "@prisma/client";
import type { SessionUser } from "../auth/session";
import { parseApplicationAnswers } from "./answers";
import { applicationAnswerLabels, canEditFamilyApplication, isEditableApplicationStatus } from "./edit-policy";

export class ApplicationEditError extends Error {}

/** Caller supplies a transaction: the row lock serializes edits with existing review locks. */
export async function editApplicationInTransaction(tx: Prisma.TransactionClient, user: SessionUser | null, family: Family, id: string, input: unknown) {
  if (!canEditFamilyApplication(user, family) || !user) throw new ApplicationEditError("Недостаточно прав для редактирования заявки этой семьи.");
  if (typeof id !== "string" || !id.trim() || id.length > 64) throw new ApplicationEditError("Некорректный ID заявки.");
  const answers = parseApplicationAnswers(input);
  if (!answers) throw new ApplicationEditError("Заполните все ответы. Возраст: 16–99; ссылка на скриншот: http/https. Проверьте длину полей.");
  // Parameterized SQL; no status is read until concurrent accept/reject has committed.
  await tx.$queryRaw`SELECT id FROM family_applications WHERE id = ${id} AND family::text = ${family} FOR UPDATE`;
  const application = await tx.familyApplication.findFirst({ where: { id, family } });
  if (!application) throw new ApplicationEditError("Заявка не найдена.");
  if (!isEditableApplicationStatus(application.status) || application.operationLock) throw new ApplicationEditError("Заявка уже обрабатывается или завершена. Обновите страницу.");
  const previous = parseApplicationAnswers(application.answers) ?? {};
  const changes = Object.keys(applicationAnswerLabels).flatMap((field) => {
    const key = field as keyof typeof answers;
    const before = previous[key] ?? null;
    return before === answers[key] ? [] : [{ field: key, before, after: answers[key] }];
  });
  if (!changes.length) return { changed: false };
  const updated = await tx.familyApplication.updateMany({
    where: { id, family, status: { in: ["NEW", "CALL"] }, operationLock: null },
    data: { answers },
  });
  if (updated.count !== 1) throw new ApplicationEditError("Заявка уже обработана другим сотрудником.");
  await tx.auditLog.create({ data: {
    action: "APPLICATION_EDITED", actorId: user.id, targetId: id, targetType: "FamilyApplication",
    metadata: { applicationId: id, family, editorUserId: user.id, editorDiscordId: user.discordId, editorDisplayName: user.displayName, changes },
  } });
  return { changed: true };
}
