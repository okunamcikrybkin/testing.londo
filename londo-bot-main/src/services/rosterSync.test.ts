import assert from "node:assert/strict";
import test from "node:test";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { syncFamilyRoster } from "./rosterSync.js";

const config: SiteLogConfig = { apiSecret: "unit-test-value", siteUrl: "http://127.0.0.1:3000" };

test("syncFamilyRoster posts a family-scoped rank snapshot", async () => {
  let request: { body?: string; headers?: Headers; method?: string; url?: string } = {};
  const result = await syncFamilyRoster(config, "111111111111111111", "MEMPHIS", [{
    avatarUrl: null,
    discordDisplayName: "Vaflya | 566",
    discordUserId: "926534588023590922",
    discordUsername: "vaflya2101",
    family: "MEMPHIS",
    gameNickname: "Vaflya",
    rank: { key: "MEMPHIS_LEADER", label: "Leader (MEM)", priority: 11, roleId: "1545453391537242232" },
    staticId: "566",
  }], { fetchImplementation: async (url, init) => {
    request = { body: init?.body as string, headers: new Headers(init?.headers), method: init?.method, url: String(url) };
    return new Response(null, { status: 200 });
  } });

  assert.equal(result, true);
  assert.equal(request.url, "http://127.0.0.1:3000/api/internal/roster");
  assert.equal(request.method, "POST");
  assert.equal(request.headers?.get("x-londo-bot-secret"), "unit-test-value");
  const body = JSON.parse(request.body ?? "{}");
  assert.equal(body.family, "MEMPHIS");
  assert.equal(body.members[0].rankKey, "MEMPHIS_LEADER");
  assert.equal(body.members[0].rankPriority, 11);
  assert.equal(body.members[0].gameNickname, "Vaflya");
  assert.equal(body.members[0].staticId, "566");
});
