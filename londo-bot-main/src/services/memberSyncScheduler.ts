import type { GuildMember } from "discord.js";

type MemberSync = (member: GuildMember) => Promise<void>;

/** Coalesces bursty member updates so Discord role edits yield one final site sync. */
export class MemberSyncScheduler {
  private readonly pending = new Map<string, { member: GuildMember; timer: NodeJS.Timeout }>();

  constructor(private readonly sync: MemberSync, private readonly delayMs = 1_000) {}

  schedule(member: GuildMember): void {
    const existing = this.pending.get(member.id);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      this.pending.delete(member.id);
      void this.sync(member);
    }, this.delayMs);
    timer.unref();
    this.pending.set(member.id, { member, timer });
  }

  dispose(): void {
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }
}
