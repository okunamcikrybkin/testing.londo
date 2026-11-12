import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidDiscordApplicationNickname, parseApplicationAnswers } from "./answers";

const answers = {
  gameNickname: "a".repeat(26),
  staticId: "123",
  oocAge: "20",
  joinReason: "Хочу вступить",
  discoverySource: "Discord",
  charactersScreenshotUrl: "https://example.com/characters.png",
};

test("application nicknames account for both game nickname and static within Discord's limit", () => {
  const parsed = parseApplicationAnswers(answers);
  assert.ok(parsed);
  assert.equal(isValidDiscordApplicationNickname(parsed), true);
  assert.equal(isValidDiscordApplicationNickname({ ...parsed, gameNickname: "a".repeat(27) }), false);
});
