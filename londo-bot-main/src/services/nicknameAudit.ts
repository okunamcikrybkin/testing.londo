import { AuditLogEvent, type Guild } from "discord.js";
import { logWarning } from "../utils/logger.js";

const AUDIT_FRESHNESS_MS = 10_000;

type AuditEntry = {
  changes: ReadonlyArray<{ key: string }> | null;
  createdTimestamp: number;
  executorId: string | null;
  targetId: string | null;
};

export type NicknameActor = { discordUserId: string; roleIds: ReadonlySet<string> };

/** Selects only a fresh MemberUpdate audit record for this target's nickname change. */
export function findFreshNicknameActorId(entries: Iterable<AuditEntry>, targetId: string, now = Date.now()): string | null {
  for (const entry of entries) {
    const age = now - entry.createdTimestamp;
    if (entry.targetId !== targetId || age < -1_000 || age > AUDIT_FRESHNESS_MS) continue;
    if (!entry.changes?.some((change) => change.key === "nick")) continue;
    if (entry.executorId) return entry.executorId;
  }
  return null;
}

/** Resolves a verified nickname-change actor without exposing audit data in logs. */
export async function resolveNicknameActor(guild: Guild, targetId: string): Promise<NicknameActor | null> {
  try {
    const auditLogs = await guild.fetchAuditLogs({ limit: 8, type: AuditLogEvent.MemberUpdate });
    const actorId = findFreshNicknameActorId(auditLogs.entries.values(), targetId);
    if (!actorId) return null;
    const actor = await guild.members.fetch(actorId);
    return { discordUserId: actor.id, roleIds: new Set(actor.roles.cache.keys()) };
  } catch (error) {
    logWarning(`[NICKNAME_GUARD] Audit log lookup unavailable for ${targetId}: ${error instanceof Error ? error.name : "unknown error"}`);
    return null;
  }
}
