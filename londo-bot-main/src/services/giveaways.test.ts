import assert from "node:assert/strict";
import test from "node:test";
import { buildGiveawayMessage, selectGiveawayWinners, type GiveawayPayload } from "./giveaways.js";

const roles = { fam: "100000000000000001", memphis: "100000000000000002", phoenix: "100000000000000003" };
const giveaway: GiveawayPayload = {
  createdAt: new Date().toISOString(), description: "Быть участником семьи.", discordChannelId: "100000000000000004", discordMessageId: "100000000000000005", endsAt: new Date(Date.now() + 60_000).toISOString(), endedAt: null, family: "MEMPHIS", id: "giveaway-1", imageUrl: null, mentionRoleId: "FAM", organizerDiscordId: "100000000000000008", participantCount: 3, participants: [], prize: "VIP", requiredRoleId: null, status: "ACTIVE", winnerCount: 2, winners: [],
};

test("giveaway announcement uses a persistent join button and safe role mentions", () => {
  const message = buildGiveawayMessage(giveaway, roles);
  assert.deepEqual(message.allowedMentions.roles, [roles.fam]);
  assert.deepEqual(message.allowedMentions.parse, []);
  const component = message.components[0].toJSON();
  assert.equal((component.components[0] as { custom_id?: string } | undefined)?.custom_id, "giveaway:join:giveaway-1");
});

test("finished giveaway removes the join button and allows only winners to be mentioned", () => {
  const message = buildGiveawayMessage({ ...giveaway, status: "ENDED", winners: [{ discordUserId: "100000000000000006", isRerolled: false, position: 1 }, { discordUserId: "100000000000000007", isRerolled: true, position: 2 }] }, roles);
  assert.equal(message.components.length, 0);
  assert.deepEqual(message.allowedMentions.users, ["100000000000000006"]);
});

test("FAM, NONE, and CUSTOM_ROLE publication modes use only their permitted role mentions", () => {
  assert.deepEqual(buildGiveawayMessage({ ...giveaway, mentionRoleId: "FAM" }, roles).allowedMentions.roles, [roles.fam]);
  assert.deepEqual(buildGiveawayMessage({ ...giveaway, mentionRoleId: null }, roles).allowedMentions.roles, []);
  assert.deepEqual(buildGiveawayMessage({ ...giveaway, mentionRoleId: "100000000000000099" }, roles).allowedMentions.roles, ["100000000000000099"]);
});

test("active, finished, and cancelled cards retain prize, participant, condition, and status information", () => {
  const active = buildGiveawayMessage(giveaway, roles).embeds[0].toJSON();
  assert.equal(active.title, "РОЗЫГРЫШ: VIP");
  assert.match(active.description ?? "", /Участников: 3/);
  assert.match(active.description ?? "", /Условия участия/);
  assert.doesNotMatch(active.footer?.text ?? "", /<t:/);
  const finished = buildGiveawayMessage({ ...giveaway, status: "ENDED", winners: [{ discordUserId: "100000000000000006", isRerolled: false, position: 1 }] }, roles).embeds[0].toJSON();
  assert.match(finished.description ?? "", /🔴 Завершён/);
  assert.match(finished.description ?? "", /Победители/);
  assert.match(finished.description ?? "", /100000000000000006/);
  const cancelled = buildGiveawayMessage({ ...giveaway, status: "CANCELLED" }, roles).embeds[0].toJSON();
  assert.match(cancelled.description ?? "", /⚫ Отменён/);
});

test("crypto winner selection is unique and handles fewer participants than winners", () => {
  const winners = selectGiveawayWinners(["a", "a", "b"], 4);
  assert.equal(new Set(winners).size, winners.length);
  assert.deepEqual(new Set(winners), new Set(["a", "b"]));
});
