import assert from "node:assert/strict";
import test from "node:test";
import { rosterIdentity } from "./profile-identity";

test("roster prefers configured profile nickname and static over Discord identity", () => {
  assert.deepEqual(rosterIdentity(
    { gameNickname: "p1wpaw", staticId: null },
    { customGameNickname: "Londo", customStaticId: "12345" },
  ), { gameNickname: "Londo", staticId: "12345" });
});

test("roster keeps synchronized values when profile overrides are empty", () => {
  assert.deepEqual(rosterIdentity(
    { gameNickname: "p1wpaw", staticId: "67890" },
    { customGameNickname: " ", customStaticId: null },
  ), { gameNickname: "p1wpaw", staticId: "67890" });
});
