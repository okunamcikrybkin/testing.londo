import assert from "node:assert/strict";
import test from "node:test";
import type { GuildMember } from "discord.js";
import { getActiveFamilyMemberships, getFamilyMembers, getMemberFamilies } from "./members.js";

const roles = {
  fam: "111111111111111111",
  memphis: "222222222222222222",
  phoenix: "333333333333333333",
};

function memberWithRoles(roleIds: string[], id = "926534588023590922"): GuildMember {
  return {
    id,
    roles: { cache: new Map(roleIds.map((roleId) => [roleId, true])) },
  } as unknown as GuildMember;
}

test("family membership is independent for each family role when FAM is present", () => {
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam, roles.memphis]), roles), ["MEMPHIS"]);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam, roles.phoenix]), roles), ["PHOENIX"]);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam, roles.memphis, roles.phoenix]), roles), ["MEMPHIS", "PHOENIX"]);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.memphis, roles.phoenix]), roles), []);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam]), roles), []);
});

test("a dual-family member projects two active memberships with one Discord identity", () => {
  const member = memberWithRoles([roles.fam, roles.memphis, roles.phoenix]);

  assert.deepEqual(getActiveFamilyMemberships(member, roles), [
    { active: true, discordUserId: member.id, family: "MEMPHIS" },
    { active: true, discordUserId: member.id, family: "PHOENIX" },
  ]);
});

test("getFamilyMembers includes a dual-family member in both independent rosters", () => {
  const dualFamilyMember = memberWithRoles([roles.fam, roles.memphis, roles.phoenix], "dual-member");
  const members = [
    memberWithRoles([roles.fam, roles.memphis]),
    memberWithRoles([roles.fam, roles.phoenix]),
    dualFamilyMember,
    memberWithRoles([roles.memphis]),
  ];

  const memphis = getFamilyMembers(members, "MEMPHIS", roles);
  const phoenix = getFamilyMembers(members, "PHOENIX", roles);

  assert.equal(memphis.length, 2);
  assert.equal(phoenix.length, 2);
  assert.equal(memphis.includes(dualFamilyMember), true);
  assert.equal(phoenix.includes(dualFamilyMember), true);
});

test("removing one family role deactivates only that family membership", () => {
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam, roles.phoenix]), roles), ["PHOENIX"]);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.fam, roles.memphis]), roles), ["MEMPHIS"]);
  assert.deepEqual(getMemberFamilies(memberWithRoles([roles.memphis, roles.phoenix]), roles), []);
});
