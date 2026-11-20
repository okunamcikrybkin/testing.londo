import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { persistRosterSnapshot, type RosterSnapshotInput } from "./persist";

const member = (discordUserId: string, rankKey: string | null): RosterSnapshotInput["members"][number] => ({
  avatarUrl: null,
  discordDisplayName: `Display ${discordUserId}`,
  discordUserId,
  discordUsername: `user-${discordUserId}`,
  gameNickname: `game-${discordUserId}`,
  rank: rankKey
    ? { rankDisplayName: rankKey, rankKey, rankPriority: 1, rankRoleId: "12345678901234567" }
    : null,
  staticId: null,
});

function fakeDatabase(existing: Array<{ active: boolean; discordUserId: string; rankKey: string | null }>) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const events: unknown[] = [];
  let deactivation: { where: Record<string, unknown> } | undefined;
  let transactionOptions: { maxWait?: number; timeout?: number } | undefined;
  const transaction = {
    $executeRaw: async (query: { sql: string; values: unknown[] }) => {
      statements.push(query);
      return 1;
    },
    familyMembership: {
      findMany: async () => existing,
      updateMany: async (args: { where: Record<string, unknown> }) => {
        deactivation = args;
        return { count: 0 };
      },
    },
    logEvent: {
      createMany: async ({ data }: { data: unknown[] }) => {
        events.push(...data);
        return { count: data.length };
      },
    },
  };
  const database = {
    $transaction: async (
      callback: (tx: typeof transaction) => Promise<number>,
      options: { maxWait?: number; timeout?: number },
    ) => {
      transactionOptions = options;
      return callback(transaction);
    },
  } as unknown as Pick<PrismaClient, "$transaction">;
  return { database, statements, events, get deactivation() { return deactivation; }, get transactionOptions() { return transactionOptions; } };
}

test("persists a roster with two set-based upserts and only logs changed active ranks", async () => {
  const existing = [
    { active: true, discordUserId: "100000000000000001", rankKey: "OLD" },
    { active: true, discordUserId: "100000000000000002", rankKey: "SAME" },
    { active: false, discordUserId: "100000000000000003", rankKey: "OLD" },
  ];
  const fake = fakeDatabase(existing);
  const snapshot: RosterSnapshotInput = {
    family: "MEMPHIS",
    members: [
      { ...member(existing[0].discordUserId, "NEW"), discordUsername: "updated-username" },
      member(existing[1].discordUserId, "SAME"),
      member(existing[2].discordUserId, "NEW"),
      member("100000000000000004", null),
    ],
    serverId: "100000000000000099",
  };

  const changes = await persistRosterSnapshot(snapshot, fake.database);

  assert.equal(changes, 1);
  assert.equal(fake.statements.length, 2);
  assert.match(fake.statements[0].sql, /INSERT INTO "discord_identities"/);
  assert.match(fake.statements[1].sql, /INSERT INTO "family_memberships"/);
  assert.ok(fake.statements[0].values.includes("updated-username"));
  assert.equal(fake.events.length, 1);
  assert.equal(fake.deactivation?.where.family, "MEMPHIS");
  assert.deepEqual(
    (fake.deactivation?.where.discordUserId as { notIn: string[] }).notIn,
    snapshot.members.map((entry) => entry.discordUserId),
  );
  assert.equal(fake.transactionOptions?.timeout, 30_000);
});

test("an empty snapshot deactivates the whole family without generating invalid bulk SQL", async () => {
  const fake = fakeDatabase([{ active: true, discordUserId: "100000000000000001", rankKey: null }]);

  await persistRosterSnapshot({ family: "MEMPHIS", members: [], serverId: "100000000000000099" }, fake.database);

  assert.equal(fake.statements.length, 0);
  assert.deepEqual(fake.deactivation?.where, { family: "MEMPHIS", active: true });
});
