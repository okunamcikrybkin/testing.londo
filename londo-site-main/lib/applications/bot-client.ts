import "server-only";

import type { FamilyApplication } from "@prisma/client";
import { parseApplicationAnswers, type ApplicationAnswers } from "./answers";

const BOT_TIMEOUT_MS = 7_000;

export class BotOperationError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "BotOperationError";
  }
}

type BotApplication = Pick<FamilyApplication, "answers" | "id" | "family" | "createdAt" | "discordDisplayName" | "discordTextChannelId" | "discordUserId" | "discordUsername" | "discordVoiceChannelId">;
type Reviewer = { discordId: string; displayName: string };
type BotApplicationPayload = Omit<BotApplication, "answers" | "createdAt"> & { gameNicknameStatic: string | null; answers: ApplicationAnswers | null; submittedAt: string; reviewer?: Reviewer };

export function applicationPayload(
  application: BotApplication & { rejectionReason?: string | null },
  reviewer?: Reviewer,
): { application: BotApplicationPayload & { rejectionReason?: string | null } } {
  const answers = parseApplicationAnswers(application.answers);
  const gameNicknameStatic = answers ? `${answers.gameNickname} | ${answers.staticId}` : null;
  return {
    application: {
      id: application.id,
      family: application.family,
      discordUserId: application.discordUserId,
      discordUsername: application.discordUsername,
      discordDisplayName: application.discordDisplayName,
      discordTextChannelId: application.discordTextChannelId,
      discordVoiceChannelId: application.discordVoiceChannelId,
      gameNicknameStatic,
      gameNickname: answers?.gameNickname ?? null,
      staticId: answers?.staticId ?? null,
      answers,
      submittedAt: application.createdAt.toISOString(),
      ...(reviewer ? { reviewer } : {}),
      ...(application.rejectionReason === undefined
        ? {}
        : { rejectionReason: application.rejectionReason }),
    },
  };
}

function botUrl(path: string): string {
  const baseUrl = process.env.LONDO_BOT_INTERNAL_URL?.trim();
  if (!baseUrl) throw new BotOperationError("Интеграция нового LONDO Bot не настроена.");
  try { return new URL(path, baseUrl).toString(); } catch { throw new BotOperationError("Адрес внутреннего LONDO Bot настроен неверно."); }
}

function secret(): string {
  const value = process.env.LONDO_BOT_API_SECRET?.trim();
  if (!value) throw new BotOperationError("Интеграция нового LONDO Bot не настроена.");
  return value;
}

function requestDetails(path: string) {
  const target = botUrl(path);
  const segments = new URL(target).pathname.split("/").filter(Boolean);

  return {
    applicationId: segments.at(-2) ?? "unknown",
    operation: segments.at(-1) ?? "unknown",
    target,
  };
}

function logBotApi(message: string): void {
  console.info(`[LONDO Site] Bot API ${message}`);
}

function logBotApiError(message: string): void {
  console.error(`[LONDO Site] Bot API ${message}`);
}

async function callBot(path: string, payload: object): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOT_TIMEOUT_MS);
  const { applicationId, operation, target } = requestDetails(path);
  try {
    logBotApi(`request: operation=${operation}; applicationId=${applicationId}; target=${target}.`);
    const response = await fetch(target, { method: "POST", headers: { "content-type": "application/json", "x-londo-bot-secret": secret() }, body: JSON.stringify(payload), cache: "no-store", signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    const code = body && typeof body === "object" && "code" in body && typeof body.code === "string" ? body.code : undefined;
    logBotApi(`response: operation=${operation}; applicationId=${applicationId}; status=${response.status}; code=${code ?? "OK"}.`);
    if (!response.ok || !body || typeof body !== "object") {
      const cleanupFailure = body && typeof body === "object" && "operation" in body && body.operation === "cleanup";
      const messages: Record<string, string> = {
        MEMBER_NOT_FOUND: "Участник не найден на Discord-сервере. Статус заявки не изменён.",
        INVALID_APPLICATION_NICKNAME: "В заявке не указан корректный никнейм Discord (не более 32 символов). Исправьте заявку перед принятием.",
        NICKNAME_UPDATE_FAILED: "Не удалось установить участнику никнейм из заявки. Проверьте право «Управлять никнеймами» у бота; принятие отменено, статус заявки не изменён.",
        NICKNAME_PERMISSION_MISSING: "У LONDO Bot нет права «Управлять никнеймами». Никнейм не изменён, статус заявки не изменён.",
        NICKNAME_HIERARCHY: "Бот не может изменить никнейм участника из-за иерархии ролей. Поднимите роль LONDO Bot выше ролей участника.",
        ROLE_NOT_FOUND: "Одна из ролей принятия не найдена в Discord. Статус заявки не изменён.",
        MISSING_PERMISSIONS: "У LONDO Bot нет права Manage Roles. Статус заявки не изменён.",
        ROLE_HIERARCHY: "Роль LONDO Bot должна быть выше выдаваемых ролей. Статус заявки не изменён.",
        ROLE_ASSIGNMENT_FAILED: "Discord не подтвердил выдачу всех ролей. Статус заявки не изменён.",
        CHANNEL_CLEANUP_FAILED: "Не удалось удалить каналы обзвона.",
        CHANNEL_DELETE_FAILED: "Не удалось удалить каналы обзвона.",
        CHANNEL_FETCH_FAILED: "Не удалось удалить каналы обзвона.",
        CHANNEL_OWNERSHIP_MISMATCH: "Не удалось удалить каналы обзвона.",
        INVALID_REJECTION_REASON: "Укажите причину отклонения.",
      };
      throw new BotOperationError(cleanupFailure ? "Не удалось удалить каналы обзвона." : code && messages[code] ? messages[code] : "Discord Bot недоступен или не подтвердил операцию. Статус заявки не изменён.", code ?? "INVALID_REQUEST");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BotOperationError) throw error;
    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message : "Unknown error";
    logBotApiError(`network error: operation=${operation}; applicationId=${applicationId}; target=${target}; ${name}: ${message}.`);
    throw new BotOperationError("Discord Bot недоступен или не подтвердил операцию. Статус заявки не изменён.", "BOT_UNREACHABLE");
  } finally { clearTimeout(timeout); }
}

export async function createCallChannels(application: BotApplication, reviewer: Reviewer): Promise<{ textChannelId: string; voiceChannelId: string }> {
  const result = await callBot(`/internal/applications/${application.id}/call`, applicationPayload(application, reviewer));
  if (typeof result.textChannelId !== "string" || typeof result.voiceChannelId !== "string") throw new BotOperationError("Discord Bot вернул некорректный результат.");
  return { textChannelId: result.textChannelId, voiceChannelId: result.voiceChannelId };
}

export async function acceptDiscordApplication(application: BotApplication): Promise<void> { await callBot(`/internal/applications/${application.id}/accept`, applicationPayload(application)); }
export async function rejectDiscordApplication(application: BotApplication & { rejectionReason: string }): Promise<void> { await callBot(`/internal/applications/${application.id}/reject`, applicationPayload(application)); }
export async function notifyDiscordApplication(application: BotApplication & { rejectionReason?: string | null }, reviewer: Reviewer, notificationType: "CALL" | "ACCEPTED" | "REJECTED"): Promise<boolean> {
  const result = await callBot(`/internal/applications/${application.id}/notify`, { ...applicationPayload(application, reviewer), notificationType });
  return result.delivered === true;
}
