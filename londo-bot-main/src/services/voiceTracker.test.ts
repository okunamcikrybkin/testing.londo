import assert from "node:assert/strict";
import test from "node:test";
import type { GuildMember } from "discord.js";
import { VoiceTracker } from "./voiceTracker.js";

const roles = { fam: "fam", memphis: "mem", phoenix: "phx" };
function member(id: string, fam = true, overrides: Partial<{ selfMute: boolean; selfDeaf: boolean; serverMute: boolean; serverDeaf: boolean }> = {}): GuildMember { return { id, roles: { cache: new Map(fam ? [[roles.fam, true]] : []) }, voice: { selfMute: false, selfDeaf: false, serverMute: false, serverDeaf: false, ...overrides } } as unknown as GuildMember; }
function setup() { const calls: string[] = []; const tracker = new VoiceTracker({ reconcile: async (ids) => { calls.push(`reconcile:${ids.join(",")}`); }, start: async (id) => { calls.push(`start:${id}`); }, settle: async (id, active) => { calls.push(`settle:${id}:${active}`); } }, roles, { afkChannelId: "afk" }); return { calls, tracker }; }
const candidate = (m: GuildMember, count = 2, channelId = "voice") => ({ member: m, channelId, participantCount: count, mute: false, deaf: false });

test("valid join starts, solo pauses, and checkpoint settles", async () => {
  const { tracker, calls } = setup(); const a = member("a");
  await tracker.reconcile([candidate(a)]); await tracker.checkpoint(); await tracker.reconcile([candidate(a, 1)]);
  assert.deepEqual(calls, ["start:a", "settle:a:true", "settle:a:false"]);
});
test("mute, deaf, AFK, non-FAM, and dual membership never create duplicate timers", async () => {
  const { tracker, calls } = setup();
  await tracker.reconcile([candidate(member("mute", true, { selfMute: true })), candidate(member("deaf", true, { serverDeaf: true })), candidate(member("afk"), 2, "afk"), candidate(member("guest", false)), candidate(member("dual")), candidate(member("dual"))]);
  assert.deepEqual(calls, ["start:dual"]);
});
test("restart recovery starts current valid members without backdating", async () => {
  const { tracker, calls } = setup(); await tracker.reconcile([candidate(member("a")), candidate(member("b"))], true);
  assert.deepEqual(calls, ["reconcile:a,b"]);
});
