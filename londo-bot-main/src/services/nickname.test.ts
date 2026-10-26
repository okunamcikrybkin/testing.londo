import assert from "node:assert/strict";
import test from "node:test";
import { parseRosterNickname } from "./nickname.js";

test("parseRosterNickname splits only the first pipe and trims both values", () => {
  assert.deepEqual(parseRosterNickname("Vafelion | 566", "Vafelion | 566"), { gameNickname: "Vafelion", staticId: "566" });
  assert.deepEqual(parseRosterNickname("John Doe | 12345", "John Doe | 12345"), { gameNickname: "John Doe", staticId: "12345" });
  assert.deepEqual(parseRosterNickname("Name | alpha | beta", "Name | alpha | beta"), { gameNickname: "Name", staticId: "alpha | beta" });
});

test("parseRosterNickname safely preserves a malformed or absent static", () => {
  assert.deepEqual(parseRosterNickname("TestUser", "TestUser"), { gameNickname: "TestUser", staticId: null });
  assert.deepEqual(parseRosterNickname("Test | ", "Test | "), { gameNickname: "Test", staticId: null });
  assert.deepEqual(parseRosterNickname(null, "Display Name"), { gameNickname: "Display Name", staticId: null });
});
