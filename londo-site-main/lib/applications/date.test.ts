import assert from "node:assert/strict";
import { test } from "node:test";
import { formatApplicationDate } from "./date";

test("application timestamps are rendered in Moscow time", () => {
  const formatted = formatApplicationDate(new Date("2026-01-01T21:30:00.000Z"));
  assert.match(formatted, /^2 янв\./);
  assert.match(formatted, /00:30/);
  assert.match(formatted, /\(МСК\)$/);
});

test("date-only application dates use Moscow calendar day", () => {
  assert.match(formatApplicationDate("2026-01-01T21:30:00.000Z", false), /^2 января 2026 г\./);
});
