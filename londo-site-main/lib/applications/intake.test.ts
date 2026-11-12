import assert from "node:assert/strict";
import { test } from "node:test";
import { parseApplicationIntake } from "./intake";

const payload = {
  family: "MEMPHIS",
  discordUserId: "123456789012345678",
  discordUsername: "candidate",
  discordDisplayName: "Candidate",
  discordAvatar: null,
  answers: {
    gameNickname: "a".repeat(26),
    staticId: "123",
    oocAge: "20",
    joinReason: "Хочу вступить",
    discoverySource: "Discord",
    charactersScreenshotUrl: "https://example.com/characters.png",
  },
};

test("application intake accepts a composed Discord nickname of exactly 32 characters", () => {
  assert.doesNotThrow(() => parseApplicationIntake(payload));
});

test("application intake rejects a composed Discord nickname over 32 characters", () => {
  assert.throws(
    () => parseApplicationIntake({ ...payload, answers: { ...payload.answers, gameNickname: "a".repeat(27) } }),
    /не более 32 символов/,
  );
});
