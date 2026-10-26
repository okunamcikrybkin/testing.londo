import assert from "node:assert/strict";
import test from "node:test";
import type { GuildMember } from "discord.js";
import { NICKNAME_GUARD_EXEMPT_ROLE_IDS } from "../config/nicknameGuard.js";
import type { NicknameActor } from "./nicknameAudit.js";
import { NicknameGuard } from "./nicknameGuard.js";

const roles = { fam: "111111111111111111", memphis: "222222222222222222", phoenix: "333333333333333333" };
const owner = "1545123264668369040";
const leaderMem = "1545453391537242232";
const leaderPhx = "1545123264655794265";
const highStaffPhx = "1545123264643473527";
const recruitMem = "1545123264643473524";
const newbie = "1545123264626430071";
const targetId = "926534588023590922";
const botId = "999999999999999999";

function member(nickname: string | null, roleIds: string[], options: { id?: string; manageable?: boolean; setNickname?: (nickname: string | null) => Promise<unknown> } = {}): GuildMember {
  return { id: options.id ?? targetId, manageable: options.manageable ?? true, nickname, roles: { cache: new Map(roleIds.map((id) => [id, true])) }, setNickname: options.setNickname ?? (async () => undefined) } as unknown as GuildMember;
}
function actor(discordUserId: string, roleIds: string[] = []): () => Promise<NicknameActor> { return async () => ({ discordUserId, roleIds: new Set(roleIds) }); }
function guardWithLogs() {
  const warnings: string[] = []; const infos: string[] = [];
  return { guard: new NicknameGuard({ info: (message: unknown) => infos.push(String(message)), warn: (message: unknown) => warnings.push(String(message)) }), infos, warnings };
}

test("ordinary FAM member self edits are restored", async () => {
  for (const rank of [newbie, recruitMem, highStaffPhx]) {
    let restoredTo: string | null | undefined; const { guard } = guardWithLogs();
    await guard.handleUpdate(member("Vafelion | 566", [roles.fam, rank]), member("TEST", [roles.fam, rank], { setNickname: async (nickname) => { restoredTo = nickname; } }), roles, actor(targetId));
    assert.equal(restoredTo, "Vafelion | 566");
  }
});

test("Owner and both Leaders may self edit their nicknames", async () => {
  for (const exemption of [owner, leaderMem, leaderPhx]) {
    let calls = 0; const { guard } = guardWithLogs();
    await guard.handleUpdate(member("Old", [roles.fam, exemption]), member("New", [roles.fam, exemption], { setNickname: async () => { calls += 1; } }), roles, actor(targetId, [exemption]));
    assert.equal(calls, 0);
  }
  assert.equal(NICKNAME_GUARD_EXEMPT_ROLE_IDS.size, 3);
});

test("global Owner and Leader actor edits are allowed for either family", async () => {
  const ordinaryTarget = member("Old", [roles.fam, roles.phoenix, newbie]);
  for (const exemption of [owner, leaderMem, leaderPhx]) {
    let calls = 0; const { guard } = guardWithLogs();
    await guard.handleUpdate(ordinaryTarget, member("New", [roles.fam, roles.phoenix, newbie], { setNickname: async () => { calls += 1; } }), roles, actor(`actor-${exemption}`, [exemption]));
    assert.equal(calls, 0);
  }
});

test("non-FAM members are ignored and null nickname is restored", async () => {
  let calls = 0; const { guard } = guardWithLogs();
  await guard.handleUpdate(member("Old", [newbie]), member("New", [newbie], { setNickname: async () => { calls += 1; } }), roles, actor(targetId));
  assert.equal(calls, 0);
  let restoredTo: string | null | undefined;
  await guard.handleUpdate(member(null, [roles.fam, newbie]), member("New", [roles.fam, newbie], { setNickname: async (nickname) => { restoredTo = nickname; } }), roles, actor(targetId));
  assert.equal(restoredTo, null);
});

test("bot audit actor, bot bypass, and restore event guard prevent redundant updates", async () => {
  let calls = 0; const { guard } = guardWithLogs();
  await guard.handleUpdate(member("Old", [roles.fam, newbie]), member("Bot change", [roles.fam, newbie], { setNickname: async () => { calls += 1; } }), roles, actor(botId), botId);
  await guard.allowNicknameChange(targetId, async () => undefined);
  await guard.handleUpdate(member("Old", [roles.fam, newbie]), member("Future bot change", [roles.fam, newbie], { setNickname: async () => { calls += 1; } }), roles, actor(targetId));
  assert.equal(calls, 0);
  await guard.handleUpdate(member("Old", [roles.fam, newbie]), member("Attempt", [roles.fam, newbie], { setNickname: async () => { calls += 1; } }), roles, actor(targetId));
  await guard.handleUpdate(member("Attempt", [roles.fam, newbie]), member("Old", [roles.fam, newbie], { setNickname: async () => { calls += 1; } }), roles, actor(targetId));
  assert.equal(calls, 1);
});

test("unmanageable members and unavailable audit logs do not crash", async () => {
  const { guard, warnings } = guardWithLogs();
  await guard.handleUpdate(member("Old", [roles.fam, newbie]), member("Attempt", [roles.fam, newbie], { manageable: false }), roles, actor(targetId));
  await guard.handleUpdate(member("Old", [roles.fam, newbie]), member("Attempt", [roles.fam, newbie]), roles, async () => { throw new Error("unavailable"); });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0] ?? "", /member is not manageable/);
  assert.match(warnings[1] ?? "", /Audit log lookup unavailable/);
});
