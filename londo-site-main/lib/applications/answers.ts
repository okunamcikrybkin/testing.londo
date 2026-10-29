import { Prisma } from "@prisma/client";

export type ApplicationAnswers = {
  charactersScreenshotUrl: string;
  discoverySource: string;
  gameNickname: string;
  staticId: string;
  joinReason: string;
  oocAge: string;
  gameNicknameStatic: string;
};

function readAnswer(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

export function parseApplicationAnswers(value: unknown): ApplicationAnswers | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const answers = value as Record<string, unknown>;
  const gameNickname = readAnswer(answers.gameNickname ?? answers.gameNicknameStatic, 32);
  const staticId = readAnswer(answers.staticId, 30) ?? (typeof answers.gameNicknameStatic === "string" ? answers.gameNicknameStatic.split("|").slice(1).join("|").trim() : null);
  const oocAge = readAnswer(answers.oocAge, 20);
  const joinReason = readAnswer(answers.joinReason, 2_000);
  const discoverySource = readAnswer(answers.discoverySource, 1_000);
  const charactersScreenshotUrl = readAnswer(answers.charactersScreenshotUrl, 500);

  if (
    !gameNickname ||
    !staticId ||
    !oocAge ||
    !joinReason ||
    !discoverySource ||
    !charactersScreenshotUrl
  ) {
    return null;
  }

  const ageMatch = /^(\d{1,2})(?:\s*(?:лет|года?|years?))?$/i.exec(oocAge);
  const age = ageMatch ? Number(ageMatch[1]) : NaN;
  if (!Number.isInteger(age) || age < 16 || age > 99) {
    return null;
  }

  try {
    const screenshotUrl = new URL(charactersScreenshotUrl);
    if (screenshotUrl.protocol !== "http:" && screenshotUrl.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return {
    charactersScreenshotUrl,
    discoverySource,
    gameNickname,
    staticId,
    gameNicknameStatic: `${gameNickname} | ${staticId}`,
    joinReason,
    oocAge,
  };
}

export function asApplicationAnswersJson(
  answers: ApplicationAnswers,
): Prisma.InputJsonValue {
  return answers;
}
