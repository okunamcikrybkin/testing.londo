import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { persistRosterSnapshot, type RosterSnapshotInput } from "@/lib/roster/persist";

const DISCORD_ID = /^\d{17,20}$/;
const FAMILIES = ["MEMPHIS"] as const;
const MAX_MEMBERS = 2_000;
type RankInput = { rankDisplayName: string; rankKey: string; rankPriority: number; rankRoleId: string } | null;

function authorized(request: NextRequest): boolean {
  const expected = process.env.LONDO_BOT_API_SECRET;
  const value = request.headers.get("x-londo-bot-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !value) return false;
  const expectedBuffer = Buffer.from(expected); const valueBuffer = Buffer.from(value);
  return expectedBuffer.length === valueBuffer.length && timingSafeEqual(expectedBuffer, valueBuffer);
}
function record(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function text(value: unknown, field: string, max: number, required = true): string | null {
  if (typeof value !== "string") { if (required) throw new Error(`${field} is required.`); return null; }
  const result = value.trim(); if (required && !result) throw new Error(`${field} is required.`); if (result.length > max) throw new Error(`${field} is too long.`); return result || null;
}
function discordId(value: unknown, field: string): string { const result = text(value, field, 20); if (!result || !DISCORD_ID.test(result)) throw new Error(`${field} is invalid.`); return result; }
function avatarUrl(value: unknown): string | null {
  const result = text(value, "avatarUrl", 2_000, false); if (!result) return null;
  try { if (new URL(result).protocol !== "https:") throw new Error(); } catch { throw new Error("avatarUrl is invalid."); }
  return result;
}
function rank(value: Record<string, unknown>): RankInput {
  if (value.rankKey === null || value.rankKey === undefined) {
    if ([value.rankDisplayName, value.rankPriority, value.rankRoleId].some((entry) => entry !== null && entry !== undefined)) throw new Error("rank fields must all be null.");
    return null;
  }
  if (!Number.isInteger(value.rankPriority) || (value.rankPriority as number) < 1 || (value.rankPriority as number) > 12) throw new Error("rankPriority is invalid.");
  return { rankDisplayName: text(value.rankDisplayName, "rankDisplayName", 100)!, rankKey: text(value.rankKey, "rankKey", 100)!, rankPriority: value.rankPriority as number, rankRoleId: discordId(value.rankRoleId, "rankRoleId") };
}
function parseSnapshot(value: unknown): RosterSnapshotInput {
  const data = record(value); if (!data) throw new Error("Payload must be an object.");
  const family = text(data.family, "family", 20); if (!family || !FAMILIES.includes(family as typeof FAMILIES[number])) throw new Error("family is invalid.");
  if (!Array.isArray(data.members) || data.members.length > MAX_MEMBERS) throw new Error("members is invalid.");
  const members = data.members.map((entry) => { const member = record(entry); if (!member) throw new Error("member is invalid."); return { avatarUrl: avatarUrl(member.avatarUrl), discordDisplayName: text(member.discordDisplayName, "discordDisplayName", 100)!, discordUserId: discordId(member.discordUserId, "discordUserId"), discordUsername: text(member.discordUsername, "discordUsername", 100)!, gameNickname: text(member.gameNickname, "gameNickname", 100)!, rank: rank(member), staticId: text(member.staticId, "staticId", 100, false) }; });
  if (new Set(members.map((member) => member.discordUserId)).size !== members.length) throw new Error("members contains duplicate Discord IDs.");
  return { family: family as typeof FAMILIES[number], members, serverId: discordId(data.serverId, "serverId") };
}
function describePersistenceError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error.";
  const code = "code" in error && typeof error.code === "string" ? `${error.code}: ` : "";
  const message = error.message.replace(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'`]+/gi, "[redacted database URL]");
  return `${code}${message}`.slice(0, 500);
}

export async function POST(request: NextRequest) {
  if (!process.env.LONDO_BOT_API_SECRET) return NextResponse.json({ error: "Roster intake is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.text(); if (body.length > 1_000_000) return NextResponse.json({ error: "Payload is too large." }, { status: 413 });
  let snapshot: RosterSnapshotInput;
  try { snapshot = parseSnapshot(JSON.parse(body)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid roster snapshot." }, { status: 400 }); }
  try {
    const rankChanges = await persistRosterSnapshot(snapshot);
    return NextResponse.json({ accepted: true, rankChanges }, { status: 200 });
  } catch (error) {
    const detail = describePersistenceError(error);
    console.error(`[ROSTER] Failed to persist ${snapshot.family} roster: ${detail}`);
    return NextResponse.json({ error: "Unable to persist roster snapshot.", detail }, { status: 500 });
  }
}
