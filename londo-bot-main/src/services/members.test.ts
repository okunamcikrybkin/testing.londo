import assert from "node:assert/strict";
import test from "node:test";
import type { GuildMember } from "discord.js";
import { getActiveFamilyMemberships, getFamilyMembers, getMemberFamilies } from "./members.js";

const roles = { fam: "111111111111111111", memphis: "222222222222222222" };

function memberWithRoles(roleIds: string[], id = "926534588023590922"): GuildMember {
  return {
    id,
    roles: { cache: new Map(roleIds.map((roleId) => [roleId, true])) },
  } as unknown as GuildMember;
}

test("active membership requires both FAM and Memphis roles", () => {
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam, roles.memphis]), roles), ["MEMPHIS"]);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam, "333333333333333333"]), roles), []);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam, roles.memphis, "333333333333333333"]), roles), ["MEMPHIS"]);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam]), roles), []);
});

test("legacy Phoenix role does not create an active family membership", () => {
  const member = memberWithRoles([roles.fam, "333333333333333333"]);
  assert.deepEqual(getActiveFamilyMemberships(member, roles), []);
});

test("the roster contains only members of Memphis", () => {
  const members = [
    memberWithRoles([roles.fam, roles.memphis]),
    memberWithRoles([roles.fam, "333333333333333333"]),
    memberWithRoles([roles.memphis]),
  ];
  const memphis = getFamilyMembers(members, "MEMPHIS", roles);
  assert.equal(memphis.length, 1);
  assert.equal(memphis[0].roles.cache.has(roles.memphis), true);
});

test("removing either required Memphis role deactivates membership", () => {
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam, roles.memphis]), roles), ["MEMPHIS"]);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam]), roles), []);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.memphis]), roles), []);
});
