import type { Guild, Role } from "discord.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { logInfo, logWarning } from "../utils/logger.js";

const BIRTHDAY_ROLE_ID = "1545123264655794260";
const BIRTHDAY_CHANNEL_ID = "1545123266170060909";
const BIRTHDAY_TIME_ZONE = process.env.BIRTHDAY_TIME_ZONE?.trim() || "Asia/Yekaterinburg";
const TICK_MS = 5 * 60 * 1000;
const ROLE_DURATION_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

type BirthdayUser = { discordId: string; birthdayLastCelebratedYear: number | null };
type ActiveRole = { discordId: string; grantedAt: string };
type BirthdayRoleGrant = { discordId: string; birthdayRoleGrantedAt: string };
type BirthdaySnapshot = { users: BirthdayUser[]; activeRoles: ActiveRole[] };

function dateInZone(date: Date): { month: number; day: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: BIRTHDAY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { month: Number(value.month), day: Number(value.day), year: Number(value.year) };
}

async function loadBirthdays(config: SiteLogConfig, date: Date): Promise<BirthdaySnapshot> {
  const today = dateInZone(date);
  const url = new URL("/api/internal/birthdays", config.siteUrl);
  url.searchParams.set("month", String(today.month));
  url.searchParams.set("day", String(today.day));
  url.searchParams.set("year", String(today.year));
  const response = await fetch(url, { headers: { "x-londo-bot-secret": config.apiSecret }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`birthday list HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("users" in payload) || !Array.isArray(payload.users) || !("activeRoleGrants" in payload) || !Array.isArray(payload.activeRoleGrants)) throw new Error("invalid birthday list");
  const users = payload.users.filter((item): item is BirthdayUser => Boolean(item && typeof item === "object"
    && "discordId" in item && typeof item.discordId === "string" && /^\d{16,22}$/.test(item.discordId)
    && "birthdayLastCelebratedYear" in item && (item.birthdayLastCelebratedYear === null || typeof item.birthdayLastCelebratedYear === "number")));
  const activeRoles = payload.activeRoleGrants.filter((item): item is BirthdayRoleGrant => Boolean(item && typeof item === "object"
    && "discordId" in item && typeof item.discordId === "string" && /^\d{16,22}$/.test(item.discordId)
    && "birthdayRoleGrantedAt" in item && typeof item.birthdayRoleGrantedAt === "string" && !Number.isNaN(Date.parse(item.birthdayRoleGrantedAt)))
  ).map((item) => ({ discordId: item.discordId, grantedAt: item.birthdayRoleGrantedAt }));
  return { users, activeRoles };
}

async function sendBirthdayAction(config: SiteLogConfig, action: "CELEBRATED" | "ROLE_GRANTED" | "ROLE_REMOVED", discordId: string, extra: { year: number } | { grantedAt: string } | {} = {}): Promise<boolean> {
  const response = await fetch(new URL("/api/internal/birthdays", config.siteUrl), {
    body: JSON.stringify({ action, discordId, ...extra }),
    headers: { "content-type": "application/json", "x-londo-bot-secret": config.apiSecret },
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return response.ok;
}

/** Grants a birthday role for 24 hours from the actual grant time. */
export class BirthdayManager {
  #timer: NodeJS.Timeout | null = null;
  #running = false;
  #expirationTimers = new Map<string, NodeJS.Timeout>();
  #grantTimes = new Map<string, number>();

  constructor(private readonly guild: Guild, private readonly siteConfig: SiteLogConfig) {}

  start(): void {
    if (this.#timer) return;
    void this.tick();
    this.#timer = setInterval(() => void this.tick(), TICK_MS);
    this.#timer.unref();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    for (const timer of this.#expirationTimers.values()) clearTimeout(timer);
    this.#expirationTimers.clear();
  }

  private scheduleExpiration(role: Role, discordId: string, grantedAt: number, retryDelay = 0): void {
    const current = this.#expirationTimers.get(discordId);
    if (current) clearTimeout(current);
    const delay = retryDelay || Math.max(0, grantedAt + ROLE_DURATION_MS - Date.now());
    const timer = setTimeout(() => {
      this.#expirationTimers.delete(discordId);
      void this.expireRole(role, discordId, grantedAt);
    }, delay);
    timer.unref();
    this.#expirationTimers.set(discordId, timer);
  }

  private async expireRole(role: Role, discordId: string, grantedAt: number): Promise<void> {
    if (this.#grantTimes.get(discordId) !== grantedAt) return;
    try {
      let member;
      try { member = this.guild.members.cache.get(discordId) ?? await this.guild.members.fetch({ user: discordId, force: true }); }
      catch (error) {
        const unknownMember = error && typeof error === "object" && "code" in error && error.code === 10007;
        if (!unknownMember) throw error;
        member = null;
      }
      if (member?.roles.cache.has(role.id)) await member.roles.remove(role, "LONDO: birthday role expired after 24 hours");
      if (!await sendBirthdayAction(this.siteConfig, "ROLE_REMOVED", discordId)) throw new Error("role expiry state was not saved");
      this.#grantTimes.delete(discordId);
      const timer = this.#expirationTimers.get(discordId);
      if (timer) clearTimeout(timer);
      this.#expirationTimers.delete(discordId);
      logInfo(`[BIRTHDAY] 24-hour role expired for Discord ID ${discordId}.`);
    } catch {
      logWarning(`[BIRTHDAY] Role expiry failed for Discord ID ${discordId}; retrying shortly.`);
      this.scheduleExpiration(role, discordId, grantedAt, RETRY_MS);
    }
  }

  private async ensureTimedRole(role: Role, discordId: string, grantedAt: number | null): Promise<number | null> {
    let member;
    try { member = this.guild.members.cache.get(discordId) ?? await this.guild.members.fetch({ user: discordId, force: true }); }
    catch { return null; }

    if (grantedAt !== null && grantedAt + ROLE_DURATION_MS <= Date.now()) {
      this.#grantTimes.set(discordId, grantedAt);
      await this.expireRole(role, discordId, grantedAt);
      return null;
    }

    if (!member.roles.cache.has(role.id)) {
      try { await member.roles.add(role, "LONDO: birthday role"); }
      catch { logWarning(`[BIRTHDAY] Role could not be granted to Discord ID ${discordId}.`); return null; }
    }

    const effectiveGrantedAt = grantedAt ?? Date.now();
    if (grantedAt === null && !await sendBirthdayAction(this.siteConfig, "ROLE_GRANTED", discordId, { grantedAt: new Date(effectiveGrantedAt).toISOString() })) {
      try { await member.roles.remove(role, "LONDO: unable to save birthday role expiry"); } catch { /* Retry cleanup during the next sync. */ }
      logWarning(`[BIRTHDAY] Grant time could not be saved for Discord ID ${discordId}.`);
      return null;
    }
    this.#grantTimes.set(discordId, effectiveGrantedAt);
    this.scheduleExpiration(role, discordId, effectiveGrantedAt);
    return effectiveGrantedAt;
  }

  async tick(now = new Date()): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      const today = dateInZone(now);
      const snapshot = await loadBirthdays(this.siteConfig, now);
      const role = await this.guild.roles.fetch(BIRTHDAY_ROLE_ID);
      if (!role || role.managed || !role.editable) throw new Error("birthday role is unavailable or not assignable");

      const activeIds = new Set(snapshot.activeRoles.map((grant) => grant.discordId));
      for (const grant of snapshot.activeRoles) {
        const grantedAt = Date.parse(grant.grantedAt);
        this.#grantTimes.set(grant.discordId, grantedAt);
        if (grantedAt + ROLE_DURATION_MS <= now.getTime()) await this.expireRole(role, grant.discordId, grantedAt);
        else this.scheduleExpiration(role, grant.discordId, grantedAt);
      }
      for (const discordId of this.#grantTimes.keys()) {
        if (!activeIds.has(discordId) && !snapshot.users.some((user) => user.discordId === discordId)) {
          const timer = this.#expirationTimers.get(discordId);
          if (timer) clearTimeout(timer);
          this.#expirationTimers.delete(discordId);
          this.#grantTimes.delete(discordId);
        }
      }

      const birthdayIds = new Set(snapshot.users.map((user) => user.discordId));
      const channelNeeded = snapshot.users.some((user) => user.birthdayLastCelebratedYear !== today.year);
      let sendableChannel = null;
      if (channelNeeded) {
        try {
          const channel = await this.guild.channels.fetch(BIRTHDAY_CHANNEL_ID);
          if (channel?.isTextBased() && !channel.isDMBased() && channel.isSendable()) sendableChannel = channel;
        } catch { /* Role expiry and grants still proceed if the greeting channel is unavailable. */ }
      }
      if (channelNeeded && !sendableChannel) logWarning("[BIRTHDAY] Birthday channel is unavailable or not sendable.");

      for (const user of snapshot.users) {
        const currentGrant = this.#grantTimes.get(user.discordId) ?? null;
        const grantedAt = await this.ensureTimedRole(role, user.discordId, currentGrant);
        if (grantedAt === null || user.birthdayLastCelebratedYear === today.year || !sendableChannel) continue;
        try {
          await sendableChannel.send({ content: `🎉 С днём рождения, <@${user.discordId}>! Желаем отличного дня и всего самого лучшего!`, allowedMentions: { users: [user.discordId] } });
          if (!await sendBirthdayAction(this.siteConfig, "CELEBRATED", user.discordId, { year: today.year })) {
            logWarning(`[BIRTHDAY] Celebration state was not saved for Discord ID ${user.discordId}.`);
            continue;
          }
          logInfo(`[BIRTHDAY] Celebration sent for Discord ID ${user.discordId}.`);
        } catch {
          logWarning(`[BIRTHDAY] Greeting failed for Discord ID ${user.discordId}.`);
        }
      }

      for (const member of role.members.values()) {
        if (birthdayIds.has(member.id) || activeIds.has(member.id) || this.#grantTimes.has(member.id)) continue;
        try { await member.roles.remove(role, "LONDO: birthday role has no active 24-hour grant"); }
        catch { logWarning(`[BIRTHDAY] Untimed role could not be removed from Discord ID ${member.id}.`); }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      logWarning(`[BIRTHDAY] Daily sync failed: ${reason}.`);
    } finally {
      this.#running = false;
    }
  }
}
