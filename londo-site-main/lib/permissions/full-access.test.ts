import assert from "node:assert/strict";
import test from "node:test";
import { parseFullAccessDiscordIds } from "./full-access";

test("full-access Discord IDs parse from comma, whitespace, mention and JSON-like lists", () => {
  assert.deepEqual(
    parseFullAccessDiscordIds('12345678901234567, 23456789012345678\n<@!34567890123456789> ["45678901234567890"]'),
    new Set(["12345678901234567", "23456789012345678", "34567890123456789", "45678901234567890"]),
  );
});

test("full-access list ignores empty or non-Discord-ID values", () => {
  assert.deepEqual(parseFullAccessDiscordIds(undefined), new Set());
  assert.deepEqual(parseFullAccessDiscordIds("abc,12345,123456789012345678901"), new Set());
});
