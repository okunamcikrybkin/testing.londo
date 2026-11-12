import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { prisma } from "../lib/db/prisma";
import { endAfk, reconcileAfk, reviewAfk, submitAfk, tickAfk } from "../lib/afk/service";
import type { afkBot } from "../lib/afk/bot";

async function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const key = "afk-test-" + randomUUID();
  const reviewer = key + "-staff";
  const rollback = new Error("ROLLBACK");
  let checks = 0;
  try {
    await prisma.$transaction(async tx => {
      await tx.discordIdentity.create({ data: { discordUserId: key, username: key, displayName: "Temporary AFK test" } });
      await tx.user.create({ data: { discordId: reviewer, username: reviewer, displayName: "Temporary reviewer" } });
      await tx.familyMembership.create({ data: { discordUserId: key, family: "MEMPHIS", lastSyncedAt: new Date() } });
      const db = {
        $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => {
          await tx.$executeRawUnsafe("SAVEPOINT afk_operation");
          try {
            const result = await fn(tx);
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT afk_operation");
            return result;
          } catch (error) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT afk_operation");
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT afk_operation");
            throw error;
          }
        },
        afkApplication: tx.afkApplication,
        afkSession: tx.afkSession,
        familyMembership: tx.familyMembership,
        familyNotificationSettings: tx.familyNotificationSettings,
        auditLog: tx.auditLog,
      } as unknown as typeof prisma;
      let fail = false;
      const syncs: { desired: string[]; known: string[] }[] = [];
      const bot = (async (operation: string, body: object) => {
        if (operation === "check") return { code: "OK", roleId: "123456789012345678" };
        syncs.push(body as { desired: string[]; known: string[] });
        return { code: fail ? "GRANT_FAILED" : "OK" };
      }) as typeof afkBot;
      const deps = { db, bot };
      const application = await submitAfk(key, "MEMPHIS", "  reason  ", "60", key + "a", deps);
      assert.equal(application.status, "PENDING");
      assert.equal(application.reason, "reason");
      await assert.rejects(submitAfk(key, "MEMPHIS", "reason", "60", key + "b", deps), /DUPLICATE_PENDING/);
      assert.equal((await submitAfk(key, "MEMPHIS", "reason", "60", key + "a", deps)).id, application.id);
      checks += 3;

      await assert.rejects(reviewAfk(application.id, "MEMPHIS", reviewer, "reject", " ", deps));
      checks++;
      fail = true;
      await reviewAfk(application.id, "MEMPHIS", reviewer, "approve", null, deps);
      assert.equal((await tx.afkApplication.findUniqueOrThrow({ where: { id: application.id } })).status, "PENDING");
      assert.equal(await tx.afkSession.count({ where: { discordUserId: key, status: "ACTIVE" } }), 0);
      checks++;

      fail = false;
      await reviewAfk(application.id, "MEMPHIS", reviewer, "approve", null, deps);
      await reviewAfk(application.id, "MEMPHIS", reviewer, "approve", null, deps);
      assert.equal(await tx.afkSession.count({ where: { discordUserId: key, family: "MEMPHIS", status: "ACTIVE" } }), 1);
      await endAfk(key, "MEMPHIS", reviewer, deps);
      assert.deepEqual(syncs.at(-1)?.desired, []);
      checks += 2;

      const expiring = await submitAfk(key, "MEMPHIS", "expiry", "60", key + "c", deps);
      await reviewAfk(expiring.id, "MEMPHIS", reviewer, "approve", null, deps);
      await tx.afkSession.updateMany({ where: { applicationId: expiring.id }, data: { endAt: new Date(Date.now() - 1_000) } });
      await tickAfk(deps);
      assert.equal((await tx.afkApplication.findUniqueOrThrow({ where: { id: expiring.id } })).status, "ENDED");
      assert.deepEqual(syncs.at(-1)?.desired, []);
      checks++;

      const rejected = await submitAfk(key, "MEMPHIS", "rejected", "60", key + "d", deps);
      await reviewAfk(rejected.id, "MEMPHIS", reviewer, "reject", "не подходит", deps);
      assert.equal((await tx.afkApplication.findUniqueOrThrow({ where: { id: rejected.id } })).rejectionReason, "не подходит");
      await reconcileAfk(key, deps);
      assert.equal(await tx.afkApplication.count({ where: { discordUserId: key, status: { in: ["ENDED", "REJECTED"] } } }), 3);
      checks += 2;
      throw rollback;
    }, { timeout: 60_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(await prisma.discordIdentity.count({ where: { discordUserId: key } }), 0);
  console.log("PASS: " + checks + " AFK PostgreSQL checks; all fixtures rolled back.");
}

main().catch(error => {
  console.error({ name: error?.name, code: error?.code, metaCode: error?.meta?.code, assertion: error?.operator });
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
