import assert from "node:assert/strict";
import test from "node:test";
import type { GuildMember } from "discord.js";
import { FAMILY_RANKS } from "../config/familyRanks.js";
import { getFamilyRoster, getMemberFamilies } from "./members.js";
import { resolveFamilyRank } from "./ranks.js";

const familyRoles = { fam: "111111111111111111", memphis: "222222222222222222" };
const rank = (key: string) => {
  const result = FAMILY_RANKS.find((item) => item.key === key);
  if (!result) throw new Error(`Unknown rank fixture: ${key}`);
  return result.roleId;
};

test("removed Memphis Leader role is not required or resolved", () => {
  assert.equal(process.env.MEMPHIS_LEADER_ROLE_ID, undefined);
  assert.equal(FAMILY_RANKS.some((item) => item.key === "MEMPHIS_LEADER"), false);
});

function member(roleIds: string[], id = "926534588023590922", roleNames: Record<string, string> = {}): GuildMember {
  return {
    id,
    displayName: "Vaflya",
    displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png",
    roles: { cache: new Map(roleIds.map((roleId) => [roleId, roleNames[roleId] ? { name: roleNames[roleId] } : true])) },
    user: { username: "vaflya2101" },
  } as unknown as GuildMember;
}

test("rank resolver honors the configured Memphis hierarchy chain", () => {
  const memphis = ["OWNER", "MEMPHIS_DEP_OWNER", "MEMPHIS_HIGH_STAFF", "MEMPHIS_CUR_RECRUIT", "MEMPHIS_RECRUIT", "MAIN", "LONDEST_LONDO", "LONDO", "YOUNG_LONDO", "BABY_LONDO", "NEWBIE"];
  for (const [index, key] of memphis.entries()) assert.equal(resolveFamilyRank(member(memphis.slice(index).map(rank)), "MEMPHIS")?.key, key);
});

test("active rank resolution ignores legacy Phoenix roles", () => {
  const dual = member([familyRoles.fam, familyRoles.memphis, rank("MEMPHIS_HIGH_STAFF"), "333333333333333333"]);
  assert.equal(resolveFamilyRank(dual, "MEMPHIS")?.key, "MEMPHIS_HIGH_STAFF");
  assert.equal(resolveFamilyRank(member([rank("LONDO")]), "MEMPHIS")?.key, "LONDO");
  assert.equal(resolveFamilyRank(member([rank("LONDO")]), "PHOENIX"), null);
});

test("roster sync reports Memphis only and keeps rankless members", () => {
  const dual = member([familyRoles.fam, familyRoles.memphis, "333333333333333333", rank("MEMPHIS_HIGH_STAFF")]);
  const rankless = member([familyRoles.fam, familyRoles.memphis], "rankless");
  assert.deepEqual(getMemberFamilies(dual, familyRoles), ["MEMPHIS"]);
  assert.equal(getFamilyRoster([dual, rankless], "MEMPHIS", familyRoles)[0]?.rank?.key, "MEMPHIS_HIGH_STAFF");
  assert.equal(getFamilyRoster([dual, rankless], "MEMPHIS", familyRoles)[1]?.rank, null);
});

test("unconfigured Legend-style roles never resolve a rank", () => {
  assert.equal(resolveFamilyRank(member(["999999999999999999"]), "MEMPHIS"), null);
});

test("known rank names resolve when Discord role IDs differ from the legacy mapping", () => {
  const ownerId = "111111111111111111", deputyId = "222222222222222222";
  assert.equal(resolveFamilyRank(member([ownerId], "owner", { [ownerId]: "Owner" }), "MEMPHIS")?.key, "OWNER");
  assert.equal(resolveFamilyRank(member([deputyId], "deputy", { [deputyId]: "Dep.Owner" }), "MEMPHIS")?.key, "MEMPHIS_DEP_OWNER");
});

test("a recognized role name overrides a stale ID that used to belong to another rank", () => {
  const ownerId = rank("OWNER");
  assert.equal(resolveFamilyRank(member([ownerId], "renamed", { [ownerId]: "Dep.Owner" }), "MEMPHIS")?.key, "MEMPHIS_DEP_OWNER");
});
