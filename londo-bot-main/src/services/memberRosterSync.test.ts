import assert from "node:assert/strict";
import test from "node:test";
import type { GuildMember } from "discord.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { getMemberRosterSync } from "./members.js";
import { syncRosterMember } from "./memberRosterSync.js";
import { MemberSyncScheduler } from "./memberSyncScheduler.js";

const roles = { fam: "fam", memphis: "mem", phoenix: "phx" };
const config: SiteLogConfig = { apiSecret: "unit-test-value", siteUrl: "http://127.0.0.1:3000" };
function member(id = "926534588023590922", roleIds = ["fam", "mem", "phx"]): GuildMember {
  return { displayAvatarURL: () => "https://cdn.example/avatar.png", displayName: "Vafelion | 566", id, nickname: "Vafelion | 566", roles: { cache: new Map(roleIds.map((role) => [role, true])) }, user: { username: "vafelion" } } as unknown as GuildMember;
}

test("member sync projects independent active and inactive family memberships", () => {
  const payload = getMemberRosterSync(member(), roles);
  assert.equal(payload.gameNickname, "Vafelion");
  assert.equal(payload.staticId, "566");
  assert.deepEqual(payload.memberships.map(({ active, family }) => ({ active, family })), [{ active: true, family: "MEMPHIS" }, { active: true, family: "PHOENIX" }]);
  assert.deepEqual(getMemberRosterSync(member("926534588023590922", ["mem"]), roles).memberships.map(({ active }) => active), [false, false]);
});

test("member sync retries a temporary site failure with one stable payload", async () => {
  let attempts = 0;
  let body = "";
  const result = await syncRosterMember(config, "111111111111111111", member(), roles, {
    delay: async () => undefined,
    fetchImplementation: async (_url, init) => { attempts += 1; body = String(init?.body); return new Response(null, { status: attempts === 3 ? 200 : 503 }); },
  });
  assert.equal(result, true);
  assert.equal(attempts, 3);
  assert.equal(JSON.parse(body).memberships.length, 2);
});

test("member updates within the debounce window produce one final sync", async () => {
  const synced: string[] = [];
  const scheduler = new MemberSyncScheduler(async (value) => { synced.push(value.nickname ?? ""); }, 5);
  scheduler.schedule(member("926534588023590922", ["fam", "mem"]));
  const changed = member("926534588023590922", ["fam", "mem"]);
  Object.assign(changed, { nickname: "Vafelion2 | 777" });
  scheduler.schedule(changed);
  await new Promise((resolve) => setTimeout(resolve, 20));
  scheduler.dispose();
  assert.deepEqual(synced, ["Vafelion2 | 777"]);
});
