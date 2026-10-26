import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  asApplicationAnswersJson,
  parseApplicationAnswers,
  type ApplicationAnswers,
} from "@/lib/applications/answers";
import { prisma } from "@/lib/db/prisma";

const MAX_TEXT_LENGTH = 100;
const MAX_ANSWERS_LENGTH = 30_000;

export type ApplicationIntake = {
  family: "MEMPHIS" | "PHOENIX";
  discordUserId: string;
  discordUsername: string;
  discordDisplayName: string;
  discordAvatar: string | null;
  answers: Prisma.InputJsonValue;
};

export class ApplicationInputError extends Error {}

function readText(value: unknown, field: string, maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") {
    throw new ApplicationInputError(`Поле ${field} обязательно.`);
  }

  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new ApplicationInputError(`Поле ${field} имеет недопустимую длину.`);
  }

  return text;
}

export function parseApplicationIntake(payload: unknown): ApplicationIntake {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApplicationInputError("Тело заявки должно быть объектом.");
  }

  const value = payload as Record<string, unknown>;
  if (value.family !== "MEMPHIS") {
    throw new ApplicationInputError("Выбрана неизвестная семья.");
  }

  const answers = parseApplicationAnswers(value.answers);
  if (!answers) {
    throw new ApplicationInputError("Ответы анкеты заполнены некорректно.");
  }

  if (JSON.stringify(answers).length > MAX_ANSWERS_LENGTH) {
    throw new ApplicationInputError("Ответы анкеты слишком большие.");
  }

  const avatar = value.discordAvatar;
  if (avatar !== null && avatar !== undefined) {
    if (typeof avatar !== "string" || avatar.length > 500) {
      throw new ApplicationInputError("Аватар имеет неверный формат.");
    }

    try {
      const avatarUrl = new URL(avatar);
      if (avatarUrl.protocol !== "https:" || avatarUrl.hostname !== "cdn.discordapp.com") {
        throw new Error("Unsupported avatar host");
      }
    } catch {
      throw new ApplicationInputError("Аватар имеет неверный формат.");
    }
  }

  return {
    answers: asApplicationAnswersJson(answers),
    discordAvatar: typeof avatar === "string" ? avatar : null,
    discordDisplayName: readText(value.discordDisplayName, "discordDisplayName"),
    discordUserId: readText(value.discordUserId, "discordUserId", 64),
    discordUsername: readText(value.discordUsername, "discordUsername"),
    family: value.family,
  };
}

export function isValidBotSecret(requestSecret: string | null): boolean {
  // LONDO_BOT_API_SECRET is the shared secret for the new dedicated bot.
  // Keep the legacy name as a compatibility fallback for the older interaction route.
  const configuredSecret = process.env.LONDO_BOT_API_SECRET ?? process.env.DISCORD_BOT_API_SECRET;

  if (!configuredSecret || !requestSecret) {
    return false;
  }

  const expected = Buffer.from(configuredSecret);
  const received = Buffer.from(requestSecret);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function createFamilyApplication(input: ApplicationIntake) {
  if (input.family !== "MEMPHIS") throw new ApplicationInputError("Семья больше недоступна.");
  return prisma.$transaction(async (transaction) => {
    const application = await transaction.familyApplication.create({
      data: input,
    });

    await transaction.auditLog.create({
      data: {
        action: "APPLICATION_CREATED",
        metadata: { family: input.family },
        targetId: application.id,
        targetType: "FamilyApplication",
      },
    });

    return application;
  });
}

/** Reuses the trusted intake path for verified Discord interaction submissions. */
export async function submitFamilyApplication(input: {
  answers: ApplicationAnswers;
  discordAvatar: string | null;
  discordDisplayName: string;
  discordUserId: string;
  discordUsername: string;
  family: "MEMPHIS" | "PHOENIX";
}) {
  if (input.family !== "MEMPHIS") throw new ApplicationInputError("Семья больше недоступна.");
  return createFamilyApplication({
    ...input,
    answers: asApplicationAnswersJson(input.answers),
  });
}

export function isActiveApplicationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
