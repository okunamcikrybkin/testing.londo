import assert from "node:assert/strict";
import test from "node:test";
import { formatCoins } from "./format";

test("formats coin amounts as truncated whole numbers", () => {
  assert.equal(formatCoins("125.6336"), "125");
  assert.equal(formatCoins("125.9999"), "125");
  assert.equal(formatCoins("-125.6336"), "-125");
  assert.equal(formatCoins("0.9999"), "0");
});

test("formats large amounts without grouping separators", () => {
  assert.equal(formatCoins("1234567.9"), "1234567");
  assert.equal(formatCoins(1.25e3), "1250");
});
