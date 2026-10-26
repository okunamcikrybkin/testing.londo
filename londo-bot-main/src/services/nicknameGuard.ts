import type { GuildMember } from "discord.js";
import { hasNicknameGuardExemption } from "../config/nicknameGuard.js";
import type { FamilyRoleIds } from "../types/family.js";
import { logInfo, logWarning } from "../utils/logger.js";
import type { NicknameActor } from "./nicknameAudit.js";

type NicknameMember = Pick<GuildMember, "id" | "manageable" | "nickname" | "roles" | "setNickname">;
type GuardLogger = Pick<Console, "info" | "warn">;
type ActorLookup = () => Promise<NicknameActor | null>;
const GUARD_TTL_MS = 15_000;

function safeNickname(nickname: string | null): string {
  return JSON.stringify(nickname?.replace(/[\r\n\t]/g, " ") ?? null);
}

/**
 * Restores unauthorized FAM nickname changes and provides a short bypass for
 * future bot-owned nickname updates. The guards consume their matching event.
 */
export class NicknameGuard {
  private readonly allowedChanges = new Set<string>();
  private readonly restoreTargets = new Map<string, string | null>();

  constructor(private readonly logger: GuardLogger = console) {}

  async allowNicknameChange<T>(discordUserId: string, callback: () => Promise<T>): Promise<T> {
    this.allowedChanges.add(discordUserId);
    try {
      return await callback();
    } finally {
      const timer = setTimeout(() => this.allowedChanges.delete(discordUserId), GUARD_TTL_MS);
      timer.unref();
    }
  }

  async handleUpdate(oldMember: NicknameMember, newMember: NicknameMember, roles: FamilyRoleIds, actorLookup: ActorLookup = async () => null, botUserId: string | null = null): Promise<void> {
    if (oldMember.nickname === newMember.nickname) return;

    const discordUserId = newMember.id;
    if (this.allowedChanges.delete(discordUserId)) return;

    if (this.restoreTargets.has(discordUserId)) {
      const expectedNickname = this.restoreTargets.get(discordUserId);
      if (newMember.nickname === expectedNickname) {
        this.restoreTargets.delete(discordUserId);
        return;
      }
    }

    if (!newMember.roles.cache.has(roles.fam)) return;

    let actor: NicknameActor | null = null;
    try {
      actor = await actorLookup();
    } catch (error) {
      this.logger.warn(`[NICKNAME_GUARD] Audit log lookup unavailable for ${discordUserId}: ${error instanceof Error ? error.name : "unknown error"}`);
    }
    if (actor?.discordUserId === botUserId) return;
    if (actor && hasNicknameGuardExemption(actor.roleIds)) return;
    if (actor?.discordUserId === newMember.id && hasNicknameGuardExemption(newMember.roles.cache.keys())) return;

    if (!newMember.manageable) {
      this.logger.warn(`[NICKNAME_GUARD] Cannot restore nickname for ${discordUserId}: member is not manageable`);
      return;
    }

    this.restoreTargets.set(discordUserId, oldMember.nickname);
    const timer = setTimeout(() => this.restoreTargets.delete(discordUserId), GUARD_TTL_MS);
    timer.unref();

    try {
      await newMember.setNickname(oldMember.nickname);
      this.logger.info(`[NICKNAME_GUARD] Restored nickname discordUserId=${discordUserId}; oldNickname=${safeNickname(oldMember.nickname)}; attemptedNickname=${safeNickname(newMember.nickname)}`);
    } catch (error) {
      this.restoreTargets.delete(discordUserId);
      this.logger.warn(`[NICKNAME_GUARD] Failed to restore nickname for ${discordUserId}: ${error instanceof Error ? error.name : "unknown error"}`);
    }
  }
}

export const nicknameGuard = new NicknameGuard({ info: logInfo, warn: logWarning });
