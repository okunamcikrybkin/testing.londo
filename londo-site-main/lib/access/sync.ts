import { prisma } from "@/lib/db/prisma";
import { getEffectiveAccess } from "@/lib/permissions/rbac";
import { resolveDiscordAccess } from "./resolver";
import { parseAccessObservation, type AccessObservation } from "./protocol";
import { lockAccess, restrictGrant } from "./store";

/** Discord observations change eligibility and may restrict an existing grant, never create one. */
export async function syncDiscordAccess(input: AccessObservation) {
  const observation = parseAccessObservation(input);
  return prisma.$transaction(async tx => {
    await lockAccess(tx, [observation.discordId]);
    const user = await tx.user.findUnique({ where: { discordId: observation.discordId }, include: { accessSnapshot: true, staffAccessGrants: { where: { revokedAt: null } } } });
    if (!user) return { status: "UNKNOWN_USER" };
    if (getEffectiveAccess(user) === "FULL_ACCESS") return { status: "FULL_ACCESS" };
    const observedAt = new Date(observation.observedAt);
    if (user.accessSnapshot && user.accessSnapshot.observedAt >= observedAt) return { status: "STALE_OR_DUPLICATE" };
    const { familyAccess } = resolveDiscordAccess(observation.roleIds);
    const state = { observedAt, memphisRole: familyAccess.MEMPHIS, phoenixRole: familyAccess.PHOENIX, roleIds: observation.roleIds };
    await tx.userAccessSnapshot.upsert({ where: { userId: user.id }, create: { userId: user.id, ...state }, update: state });
    const restricted = await restrictGrant(tx, user.id, user.staffAccessGrants[0], state, observation.trigger);
    return { status: restricted ? "RESTRICTED" : "ELIGIBILITY_UPDATED" };
  });
}
export async function refreshDiscordEligibility(discordId: string): Promise<void> {
  const base = process.env.LONDO_BOT_INTERNAL_URL, secret = process.env.LONDO_BOT_API_SECRET;
  if (!base || !secret) throw new Error("DISCORD_UNAVAILABLE");
  const result = await fetch(new URL("/internal/discord/access/member", base), {
    method: "POST", headers: { "content-type": "application/json", "x-londo-bot-secret": secret },
    body: JSON.stringify({ discordId }), cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  if (!result.ok) throw new Error("DISCORD_UNAVAILABLE");
  const observation = parseAccessObservation(await result.json());
  if (observation.discordId !== discordId || observation.trigger !== "OAUTH") throw new Error("INVALID_OBSERVATION");
  await syncDiscordAccess(observation);
}
export async function syncAccessOnLogin(discordId: string): Promise<void> {
  try { await refreshDiscordEligibility(discordId); }
  catch { console.warn("[ACCESS] Eligibility refresh unavailable; reconciliation will retry."); }
}
