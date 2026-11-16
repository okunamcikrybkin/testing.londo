import assert from "node:assert/strict";
import test from "node:test";
import type { Role } from "discord.js";
import { birthdayRoleIssue } from "./birthdays.js";

test("birthday role diagnostics distinguish missing, managed, and unassignable roles", () => {
  assert.match(birthdayRoleIssue(null) ?? "", /BIRTHDAY_ROLE_ID/);
  assert.match(birthdayRoleIssue({ managed: true, editable: false } as Role) ?? "", /managed by an integration/);
  assert.match(birthdayRoleIssue({ managed: false, editable: false } as Role) ?? "", /Manage Roles/);
  assert.equal(birthdayRoleIssue({ managed: false, editable: true } as Role), null);
});
