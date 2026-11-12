import test from "node:test";
import assert from "node:assert/strict";
import { Collection, type Guild } from "discord.js";
import { PromotionsManager } from "./promotions.js";
import { promotionRoleAllowlist } from "./role-allowlist.js";
import { FAMILY_RANKS } from "../config/familyRanks.js";
import type { ApplicationConfig } from "../types/family.js";

function fixture() {
  const ids = [...new Set([...promotionRoleAllowlist("MEMPHIS").map(role => role.roleId), "800000000000000001"])];
  const roles = new Collection(ids.reverse().map((id, index) => [id, { id, name: id === "800000000000000001" ? "Main" : `Discord name ${index}`, position: index, managed: false, editable: true, tags: null, comparePositionTo: () => -1 }]));
  let fetches = 0;
  const member = { roles: { cache: new Collection([["fam", {}], ["memphis", {}]]) }, user: { username: "user" }, displayName: "User" };
  const guild = { id: "guild", roles: { cache: roles, fetch: async (id?: string) => { fetches++; return id ? roles.get(id) : roles; } }, channels: { cache: new Collection(), fetch: async () => undefined }, members: { fetch: async () => { fetches++; return member; }, fetchMe: async () => ({ permissions: { has: () => true }, roles: { highest: {} } }) } } as unknown as Guild;
  const config: ApplicationConfig = { applicationChannelId: "channel", callCategoryId: "category", port: 3101, staffRoleIds: { MEMPHIS: [] }, acceptRoleIds: { MEMPHIS: [] } };
  return { roles, fetches: () => fetches, manager: new PromotionsManager(guild, { siteUrl: "http://invalid", apiSecret: "test" }, { fam: "fam", memphis: "memphis" }, config) };
}

test("configured promotion IDs preserve the Memphis roster mapping and priorities", () => {
  for (const role of promotionRoleAllowlist("MEMPHIS")) assert.ok(FAMILY_RANKS.some(rank => rank.roleId === role.roleId && rank.scopes.includes("MEMPHIS")));
  assert.equal(promotionRoleAllowlist("PHOENIX").length, 0);
  assert.equal(FAMILY_RANKS.find(rank => rank.key === "MAIN")?.priority, 6);
});

test("options exposes only Memphis ranks and keeps Discord safety filtering", async () => {
  const f = fixture();
  assert.deepEqual((await f.manager.options("MEMPHIS")).roles.map(role => role.id), promotionRoleAllowlist("MEMPHIS").map(role => role.roleId));
  assert.deepEqual((await f.manager.options("PHOENIX")).roles, []);
  const baby = process.env.BABY_LONDO_ROLE_ID!;
  f.roles.get(baby)!.managed = true;
  assert.equal((await f.manager.options("MEMPHIS")).roles.some(role => role.id === baby), false);
  assert.deepEqual((await f.manager.options()).roles, []);
});

test("internal checks reject forged and non-promotion IDs before Discord calls", async () => {
  const f = fixture();
  for (const id of ["800000000000000001", process.env.NEWBIE_ROLE_ID!]) {
    await assert.rejects(f.manager.check("800000000000000099", id, "MEMPHIS"), /недоступна/);
  }
  assert.equal(f.fetches(), 0);
  assert.equal((await f.manager.check("800000000000000099", process.env.MEMPHIS_RECRUIT_ROLE_ID!, "MEMPHIS")).owned, false);
  assert.equal((await f.manager.check("800000000000000099", process.env.BABY_LONDO_ROLE_ID!, "MEMPHIS")).owned, false);
});
