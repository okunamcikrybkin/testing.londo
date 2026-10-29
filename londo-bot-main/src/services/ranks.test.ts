import assert from "node:assert/strict";
import test from "node:test";
import type { GuildMember } from "discord.js";
import { FAMILY_RANKS } from "../config/familyRanks.js";
import { getFamilyRoster, getMemberFamilies } from "./members.js";
import { resolveFamilyRank } from "./ranks.js";

const familyRoles = { fam: "111111111111111111", memphis: "222222222222222222", phoenix: "333333333333333333" };
const rank = (key: string) => {
  const result = FAMILY_RANKS.find((item) => item.key === key);
  if (!result) throw new Error(`Unknown rank fixture: ${key}`);
  return result.roleId;
};

function member(roleIds: string[], id = "926534588023590922", roleNames: Record<string, string> = {}): GuildMember {
  return {
    id,
    displayName: "Vaflya",
    displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png",
    roles: { cache: new Map(roleIds.map((roleId) => [roleId, roleNames[roleId] ? { name: roleNames[roleId] } : true])) },
    user: { username: "vaflya2101" },
  } as unknown as GuildMember;
}

test("rank resolver honors the full configured hierarchy chain for both families", () => {
  const memphis = ["OWNER", "MEMPHIS_LEADER", "MEMPHIS_DEP_OWNER", "MEMPHIS_HIGH_STAFF", "MEMPHIS_CUR_RECRUIT", "MEMPHIS_RECRUIT", "MAIN", "LONDEST_LONDO", "LONDO", "YOUNG_LONDO", "BABY_LONDO", "NEWBIE"];
  const phoenix = ["OWNER", "PHOENIX_LEADER", "PHOENIX_DEP_OWNER", "PHOENIX_HIGH_STAFF", "PHOENIX_CUR_RECRUIT", "PHOENIX_RECRUIT", "MAIN", "LONDEST_LONDO", "LONDO", "YOUNG_LONDO", "BABY_LONDO", "NEWBIE"];
  for (const [index, key] of memphis.entries()) assert.equal(resolveFamilyRank(member(memphis.slice(index).map(rank)), "MEMPHIS")?.key, key);
  for (const [index, key] of phoenix.entries()) assert.equal(resolveFamilyRank(member(phoenix.slice(index).map(rank)), "PHOENIX")?.key, key);
});

test("family scoped ranks stay isolated while common ranks work for both", () => {
  const dual = member([familyRoles.fam, familyRoles.memphis, familyRoles.phoenix, rank("MEMPHIS_LEADER"), rank("PHOENIX_RECRUIT")]);
  assert.equal(resolveFamilyRank(dual, "MEMPHIS")?.key, "MEMPHIS_LEADER");
  assert.equal(resolveFamilyRank(dual, "PHOENIX")?.key, "PHOENIX_RECRUIT");
  assert.equal(resolveFamilyRank(member([rank("LONDO")]), "MEMPHIS")?.key, "LONDO");
  assert.equal(resolveFamilyRank(member([rank("LONDO")]), "PHOENIX")?.key, "LONDO");
});

test("dual membership produces both independent ranks and keeps rankless members", () => {
  const dual = member([familyRoles.fam, familyRoles.memphis, familyRoles.phoenix, rank("MEMPHIS_HIGH_STAFF"), rank("PHOENIX_RECRUIT")]);
  const rankless = member([familyRoles.fam, familyRoles.memphis], "rankless");
  assert.deepEqual(getMemberFamilies(dual, familyRoles), ["MEMPHIS", "PHOENIX"]);
  assert.equal(getFamilyRoster([dual, rankless], "MEMPHIS", familyRoles)[0]?.rank?.key, "MEMPHIS_HIGH_STAFF");
  assert.equal(getFamilyRoster([dual, rankless], "PHOENIX", familyRoles)[0]?.rank?.key, "PHOENIX_RECRUIT");
  assert.equal(getFamilyRoster([dual, rankless], "MEMPHIS", familyRoles)[1]?.rank, null);
});

test("unconfigured Legend-style roles never resolve a rank", () => {
  assert.equal(resolveFamilyRank(member(["999999999999999999"]), "MEMPHIS"), null);
});

test("known rank names resolve when Discord role IDs differ from the legacy mapping", () => {
  const ownerId = "111111111111111111", deputyId = "222222222222222222";
  assert.equal(resolveFamilyRank(member([ownerId], "owner", { [ownerId]: "Owner" }), "MEMPHIS")?.key, "OWNER");
  assert.equal(resolveFamilyRank(member([deputyId], "deputy", { [deputyId]: "Dep.Owner" }), "MEMPHIS")?.key, "MEMPHIS_DEP_OWNER");
  assert.equal(resolveFamilyRank(member([deputyId], "deputy", { [deputyId]: "Dep.Owner" }), "PHOENIX"), null);
});

test("a recognized role name overrides a stale ID that used to belong to another rank", () => {
  const ownerId = rank("OWNER");
  assert.equal(resolveFamilyRank(member([ownerId], "renamed", { [ownerId]: "Dep.Owner" }), "MEMPHIS")?.key, "MEMPHIS_DEP_OWNER");
});
