import type { GuildMember } from "discord.js";
import type { FamilyRoleIds, VoiceConfig } from "../types/family.js";

export type VoicePersistence = { reconcile(ids: string[]): Promise<void>; start(id: string): Promise<void>; settle(id: string, keepActive: boolean): Promise<void> };
type Candidate = { channelId: string | null; deaf: boolean; member: GuildMember; mute: boolean; participantCount: number };

/** Tracks valid FAM voice segments; persistence owns exact checkpoint accounting. */
export class VoiceTracker {
  private readonly active = new Set<string>();
  constructor(private readonly persistence: VoicePersistence, private readonly roles: FamilyRoleIds, private readonly config: VoiceConfig) {}
  private valid(candidate: Candidate): boolean {
    const state = candidate.member.voice;
    return candidate.member.roles.cache.has(this.roles.fam) && Boolean(candidate.channelId) && candidate.channelId !== this.config.afkChannelId && !candidate.mute && !candidate.deaf && candidate.participantCount >= 2 && !state.selfMute && !state.selfDeaf && !state.serverMute && !state.serverDeaf;
  }
  async reconcile(candidates: Candidate[], restart = false): Promise<void> {
    const desired = new Set(candidates.filter((candidate) => this.valid(candidate)).map((candidate) => candidate.member.id));
    if (restart) { await this.persistence.reconcile([...desired]); this.active.clear(); for (const id of desired) this.active.add(id); return; }
    for (const id of this.active) if (!desired.has(id)) { await this.persistence.settle(id, false); this.active.delete(id); }
    for (const id of desired) if (!this.active.has(id)) { await this.persistence.start(id); this.active.add(id); }
  }
  async checkpoint(): Promise<void> { for (const id of this.active) await this.persistence.settle(id, true); }
  get activeCount(): number { return this.active.size; }
}
