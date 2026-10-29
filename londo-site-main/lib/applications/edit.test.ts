import assert from "node:assert/strict";
import { test } from "node:test";
import type { Family, Prisma } from "@prisma/client";
import type { SessionUser } from "../auth/session";
import { canEditFamilyApplication } from "./edit-policy";
import { editApplicationInTransaction } from "./edit-service";

const answers = { gameNicknameStatic: "Nick | 123", oocAge: "20", joinReason: "С друзьями", discoverySource: "Discord", charactersScreenshotUrl: "https://example.org/image.png" };
const user = { id: "staff", discordId: "123456789012345678", displayName: "Editor", effectiveAccess: "RECRUIT", pinVerified: true, familyAccess: { MEMPHIS: "RECRUIT", PHOENIX: "USER" } } as SessionUser;
function fixture(status = "NEW", family: Family = "MEMPHIS", lock: string | null = null) {
  const row = { id: "app", family, status, operationLock: lock, answers: { ...answers } };
  const events: Prisma.AuditLogCreateArgs[] = [];
  let writes = 0;
  let found = true;
  const tx = {
    $queryRaw: async () => [],
    familyApplication: {
      findFirst: async ({ where }: { where: { family: Family; id: string } }) => found && where.family === row.family && where.id === row.id ? row : null,
      updateMany: async () => { writes++; row.answers = { ...answers, joinReason: "Новая причина" }; return { count: 1 }; },
    },
    auditLog: { create: async (arg: Prisma.AuditLogCreateArgs) => { events.push(arg); } },
  } as unknown as Prisma.TransactionClient;
  return { tx, row, events, writes: () => writes, missing: () => { found = false; } };
}
const changed = { ...answers, joinReason: "Новая причина" };

for (const status of ["NEW", "CALL"]) test(`RECRUIT edits ${status} and records editor/before/after`, async () => {
  const f = fixture(status);
  assert.deepEqual(await editApplicationInTransaction(f.tx, user, "MEMPHIS", "app", changed), { changed: true });
  assert.equal(f.writes(), 1);
  assert.equal(f.events.length, 1);
  assert.deepEqual(f.events[0].data, { action: "APPLICATION_EDITED", actorId: user.id, targetType: "FamilyApplication", targetId: "app", metadata: { applicationId: "app", family: "MEMPHIS", editorUserId: user.id, editorDiscordId: user.discordId, editorDisplayName: "Editor", changes: [{ field: "joinReason", before: answers.joinReason, after: changed.joinReason }] } });
});
for (const access of ["USER", "FAMQ"] as const) test(`${access} denied even with stale scope`, async () => {
  const f = fixture();
  await assert.rejects(editApplicationInTransaction(f.tx, { ...user, effectiveAccess: access }, "MEMPHIS", "app", changed));
  assert.equal(f.writes(), 0);
});
test("authentication and PIN required; OWNER scope is enforced", async () => {
  for (const actor of [null, { ...user, pinVerified: false }, { ...user, effectiveAccess: "OWNER" as const, familyAccess: { MEMPHIS: "USER" as const, PHOENIX: "OWNER" as const } }]) {
    const f = fixture();
    await assert.rejects(editApplicationInTransaction(f.tx, actor, "MEMPHIS", "app", changed));
    assert.equal(f.writes(), 0);
  }
});
for (const access of ["RECRUIT", "HIGH_STAFF", "OWNER"] as const) test(`${access} allowed within approved family`, () => {
  assert.equal(canEditFamilyApplication({ ...user, effectiveAccess: access, familyAccess: { MEMPHIS: access, PHOENIX: "USER" } }, "MEMPHIS"), true);
});
for (const family of ["MEMPHIS", "PHOENIX"] as const) {
  test(`opposite scope denied for ${family}`, async () => {
    const f = fixture("NEW", family);
    const actor = { ...user, familyAccess: { MEMPHIS: family === "MEMPHIS" ? "USER" : "RECRUIT", PHOENIX: family === "PHOENIX" ? "USER" : "RECRUIT" } } as SessionUser;
    await assert.rejects(editApplicationInTransaction(f.tx, actor, family, "app", changed));
    assert.equal(f.writes(), 0);
  });
  test(`FULL_ACCESS edits ${family} without PIN`, async () => {
    const f = fixture("NEW", family);
    assert.equal((await editApplicationInTransaction(f.tx, { ...user, effectiveAccess: "FULL_ACCESS", pinVerified: false }, family, "app", changed)).changed, true);
  });
}
for (const status of ["ACCEPTED", "REJECTED"]) test(`${status} immutable`, async () => {
  const f = fixture(status);
  await assert.rejects(editApplicationInTransaction(f.tx, user, "MEMPHIS", "app", changed));
  assert.equal(f.writes(), 0); assert.equal(f.events.length, 0);
});
test("review operation in progress blocks edit", async () => {
  const f = fixture("CALL", "MEMPHIS", "accept:123");
  await assert.rejects(editApplicationInTransaction(f.tx, user, "MEMPHIS", "app", changed));
  assert.equal(f.writes(), 0);
});
test("status is read after row lock (concurrent finalization)", async () => {
  const f = fixture("CALL");
  f.tx.$queryRaw = (async () => { f.row.status = "ACCEPTED"; return []; }) as typeof f.tx.$queryRaw;
  await assert.rejects(editApplicationInTransaction(f.tx, user, "MEMPHIS", "app", changed));
  assert.equal(f.writes(), 0);
});
for (const input of [{ ...answers, oocAge: "13" }, { ...answers, oocAge: "100" }, { ...answers, charactersScreenshotUrl: "javascript:alert(1)" }, { ...answers, charactersScreenshotUrl: "invalid" }, { ...answers, joinReason: "  " }]) test(`invalid answers rejected: ${JSON.stringify(input)}`, async () => {
  const f = fixture();
  await assert.rejects(editApplicationInTransaction(f.tx, user, "MEMPHIS", "app", input));
  assert.equal(f.writes(), 0);
});
test("no changes creates no audit or write; same submit validation accepts boundaries", async () => {
  const f = fixture();
  assert.deepEqual(await editApplicationInTransaction(f.tx, user, "MEMPHIS", "app", { ...answers, joinReason: ` ${answers.joinReason} ` }), { changed: false });
  assert.equal(f.writes(), 0); assert.equal(f.events.length, 0);
  for (const age of ["16", "99", "20 лет"]) assert.equal((await editApplicationInTransaction(f.tx, user, "MEMPHIS", "app", { ...changed, oocAge: age })).changed, true);
});
test("missing ID/family mismatch rejected", async () => {
  const f = fixture();
  for (const id of ["", "missing", "x".repeat(65)]) await assert.rejects(editApplicationInTransaction(f.tx, user, "MEMPHIS", id, changed));
  f.missing();
  await assert.rejects(editApplicationInTransaction(f.tx, user, "MEMPHIS", "app", changed));
  assert.equal(f.writes(), 0);
});
