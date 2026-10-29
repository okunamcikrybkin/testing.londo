import type { SiteLogConfig } from "../config/siteLogs.js";
import type { Family } from "../types/family.js";

const TIMEOUT_MS = 5_000;

export type ApplicationAnswers = { gameNicknameStatic: string; oocAge: string; joinReason: string; discoverySource: string; charactersScreenshotUrl: string };
export type DiscordApplicant = { discordUserId: string; discordUsername: string; discordDisplayName: string; discordAvatar: string | null };

export class ApplicationSubmissionError extends Error { constructor(readonly kind: "DUPLICATE" | "UNAVAILABLE" | "INVALID") { super(kind); } }

export function validateApplicationAnswers(value: ApplicationAnswers): ApplicationAnswers | null {
  const clean = (input: string, max: number) => input.trim().slice(0, max);
  const gameNicknameStatic = value.gameNicknameStatic.trim();
  const answers = { gameNicknameStatic, oocAge: clean(value.oocAge, 20), joinReason: clean(value.joinReason, 2000), discoverySource: clean(value.discoverySource, 1000), charactersScreenshotUrl: clean(value.charactersScreenshotUrl, 500) };
  const age = /^(\d{1,2})(?:\s*(?:лет|года?|years?))?$/i.exec(answers.oocAge);
  if (!answers.gameNicknameStatic || Array.from(answers.gameNicknameStatic).length > 32 || !answers.joinReason || !answers.discoverySource || !age || Number(age[1]) < 16 || Number(age[1]) > 99) return null;
  try { const url = new URL(answers.charactersScreenshotUrl); if (url.protocol !== "http:" && url.protocol !== "https:") return null; } catch { return null; }
  return answers;
}

export async function submitApplication(config: SiteLogConfig, family: Family, applicant: DiscordApplicant, answers: ApplicationAnswers): Promise<void> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(new URL("/api/applications", config.siteUrl), { method: "POST", headers: { "content-type": "application/json", "x-londo-bot-secret": config.apiSecret }, body: JSON.stringify({ family, ...applicant, answers }), signal: controller.signal });
    if (response.status === 409) throw new ApplicationSubmissionError("DUPLICATE");
    if (response.status === 400) throw new ApplicationSubmissionError("INVALID");
    if (!response.ok) throw new ApplicationSubmissionError("UNAVAILABLE");
  } catch (error) { if (error instanceof ApplicationSubmissionError) throw error; throw new ApplicationSubmissionError("UNAVAILABLE"); } finally { clearTimeout(timeout); }
}
