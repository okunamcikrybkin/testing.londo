import assert from "node:assert/strict";
import test from "node:test";
import { mentionRoleFormValue, parseGiveawayInput } from "./validation.js";
import { canDeleteGiveaway, canFinishGiveaway } from "./data.js";

const input = {
  description: "Условия участия", discordChannelId: "100000000000000001", endsAt: new Date(Date.now() + 60_000).toISOString(), family: "MEMPHIS", imageUrl: "https://example.com/prize.png", mentionMode: "FAM", prize: "VIP", requiredRoleId: "100000000000000002", winnerCount: 2,
};

test("accepts a valid future giveaway input", () => {
  const parsed = parseGiveawayInput(input);
  assert.equal(parsed.family, "MEMPHIS");
  assert.equal(parsed.mentionRoleId, "FAM");
});

test("rejects invalid prize, winner count, past end time, and Discord channel", () => {
  assert.throws(() => parseGiveawayInput({ ...input, prize: "   " }));
  assert.throws(() => parseGiveawayInput({ ...input, winnerCount: 21 }));
  assert.throws(() => parseGiveawayInput({ ...input, endsAt: new Date(Date.now() - 60_000).toISOString() }));
  assert.throws(() => parseGiveawayInput({ ...input, discordChannelId: "not-a-snowflake" }));
});

test("requires a valid custom mention role when requested", () => {
  assert.throws(() => parseGiveawayInput({ ...input, mentionMode: "CUSTOM_ROLE", mentionRoleId: "" }));
  assert.equal(parseGiveawayInput({ ...input, mentionMode: "CUSTOM_ROLE", mentionRoleId: "100000000000000003" }).mentionRoleId, "100000000000000003");
});

test("FAM and NONE do not validate or retain a custom mention role", () => {
  assert.equal(parseGiveawayInput({ ...input, mentionMode: "FAM" }).mentionRoleId, "FAM");
  assert.equal(parseGiveawayInput({ ...input, mentionMode: "NONE" }).mentionRoleId, null);
  assert.equal(mentionRoleFormValue("FAM", "100000000000000003"), "");
  assert.equal(mentionRoleFormValue("NONE", "100000000000000003"), "");
});

test("only terminal or unstarted giveaway states can be deleted", () => {
  assert.equal(canDeleteGiveaway("DRAFT"), true);
  assert.equal(canDeleteGiveaway("CANCELLED"), true);
  assert.equal(canDeleteGiveaway("ENDED"), true);
  assert.equal(canDeleteGiveaway("ACTIVE"), false);
});

test("only active giveaways can be finished manually", () => {
  assert.equal(canFinishGiveaway("ACTIVE"), true);
  assert.equal(canFinishGiveaway("DRAFT"), false);
  assert.equal(canFinishGiveaway("SCHEDULED"), false);
  assert.equal(canFinishGiveaway("ENDED"), false);
  assert.equal(canFinishGiveaway("CANCELLED"), false);
});
