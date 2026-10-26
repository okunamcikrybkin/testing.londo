import assert from "node:assert/strict";
import test from "node:test";
import { findFreshNicknameActorId } from "./nicknameAudit.js";

const now = 1_000_000;
const entry = (overrides: Partial<{ changes: { key: string }[] | null; createdTimestamp: number; executorId: string | null; targetId: string | null }> = {}) => ({ changes: [{ key: "nick" }], createdTimestamp: now - 500, executorId: "owner", targetId: "target", ...overrides });

test("fresh nickname audit entry resolves only the matching target", () => {
  assert.equal(findFreshNicknameActorId([entry()], "target", now), "owner");
  assert.equal(findFreshNicknameActorId([entry({ targetId: "other" }), entry({ changes: [{ key: "roles" }] })], "target", now), null);
});

test("stale audit entries are never used to authorize an actor", () => {
  assert.equal(findFreshNicknameActorId([entry({ createdTimestamp: now - 10_001 })], "target", now), null);
});
