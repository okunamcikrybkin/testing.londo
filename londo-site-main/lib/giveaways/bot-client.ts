import "server-only";

const TIMEOUT_MS = 8_000;

export class GiveawayBotError extends Error {}

function endpoint(path: string): string {
  const base = process.env.LONDO_BOT_INTERNAL_URL?.trim();
  if (!base) throw new GiveawayBotError("Интеграция LONDO Bot не настроена.");
  return new URL(path, base).toString();
}

function secret(): string {
  const value = process.env.LONDO_BOT_API_SECRET?.trim();
  if (!value) throw new GiveawayBotError("Интеграция LONDO Bot не настроена.");
  return value;
}

export async function publishGiveaway(id: string, giveaway: object): Promise<{ messageId: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(endpoint(`/internal/giveaways/${id}/publish`), {
      method: "POST",
      headers: { "content-type": "application/json", "x-londo-bot-secret": secret() },
      body: JSON.stringify({ giveaway }),
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body.messageId !== "string") throw new GiveawayBotError("Discord Bot не смог опубликовать розыгрыш.");
    return { messageId: body.messageId };
  } catch (error) {
    if (error instanceof GiveawayBotError) throw error;
    throw new GiveawayBotError("Discord Bot недоступен. Розыгрыш не запущен.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshGiveawayMessage(id: string, giveaway: object): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(endpoint(`/internal/giveaways/${id}/refresh`), {
      method: "POST",
      headers: { "content-type": "application/json", "x-londo-bot-secret": secret() },
      body: JSON.stringify({ giveaway }), cache: "no-store", signal: controller.signal,
    });
  } finally { clearTimeout(timeout); }
}

export async function deleteGiveawayMessage(id: string, giveaway: object): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(endpoint(`/internal/giveaways/${id}/delete`), {
      method: "POST",
      headers: { "content-type": "application/json", "x-londo-bot-secret": secret() },
      body: JSON.stringify({ giveaway }), cache: "no-store", signal: controller.signal,
    });
  } finally { clearTimeout(timeout); }
}
