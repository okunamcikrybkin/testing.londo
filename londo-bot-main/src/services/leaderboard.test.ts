import assert from "node:assert/strict";
import test from "node:test";
import type { Guild } from "discord.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { createLeaderboardEmbed, fetchLeaderboard, formatCoins, formatVoice, LeaderboardManager } from "./leaderboard.js";

const config: SiteLogConfig = { apiSecret: "unit-test-value", siteUrl: "http://127.0.0.1:3000" };
const data = { coins: Array.from({ length: 11 }, (_, index) => ({ balance: `${11 - index}.998`, discordUserId: `${926534588023590900 + index}`, totalVoiceSeconds: `${(index + 1) * 60}` })), generatedAt: "2026-09-05T00:00:00.000Z", voice: [{ balance: "1.0000", discordUserId: "926534588023590922", totalVoiceSeconds: "76500" }] };

test("leaderboard formats decimal coins, voice duration, empty fields, and limits output to ten", () => {
  assert.equal(formatCoins("3094.1600"), "3094.16");
  assert.equal(formatCoins("1.9980"), "1.99");
  assert.equal(formatVoice("2220"), "37м");
  assert.equal(formatVoice("459000"), "127ч 30м");
  const fields = createLeaderboardEmbed(data).toJSON().fields ?? [];
  assert.equal(fields[0]?.value.split("\n").length, 10);
  const empty = createLeaderboardEmbed({ coins: [], generatedAt: data.generatedAt, voice: [] }).toJSON().fields ?? [];
  assert.equal(empty[0]?.value, "Нет данных.");
  assert.equal(empty[1]?.value, "Нет данных.");
});

test("leaderboard refresh reuses a discovered message and survives a site failure", async () => {
  let edits = 0; let sends = 0;
  const message = { author: { id: "bot" }, edit: async () => { edits += 1; }, embeds: [{ footer: { text: "londo-leaderboard-v1" } }] };
  const channel = { isSendable: () => true, isTextBased: () => true, messages: { fetch: async (id?: string | object) => typeof id === "string" ? message : { find: () => message } }, send: async () => { sends += 1; return { id: "created" }; } };
  const guild = { channels: { fetch: async () => channel }, client: { user: { id: "bot" } } } as unknown as Guild;
  const manager = new LeaderboardManager(guild, { channelId: "111111111111111111", messageId: null }, config, async () => new Response(JSON.stringify(data), { status: 200 }));
  assert.equal(await manager.refresh(true), true);
  assert.equal(await manager.refresh(), false);
  assert.equal(edits, 1); assert.equal(sends, 0);
  assert.equal(await fetchLeaderboard(config, async () => { throw new Error("offline"); }), null);
});

test("scheduled refresh is throttled and does not create duplicate leaderboard messages", async () => {
  let edits = 0;
  const message = { author: { id: "bot" }, edit: async () => { edits += 1; }, embeds: [{ footer: { text: "londo-leaderboard-v1" } }] };
  const channel = { isSendable: () => true, isTextBased: () => true, messages: { fetch: async () => ({ find: () => message }) }, send: async () => ({ id: "created" }) };
  const guild = { channels: { fetch: async () => channel }, client: { user: { id: "bot" } } } as unknown as Guild;
  const manager = new LeaderboardManager(guild, { channelId: "111111111111111111", messageId: null }, config, async () => new Response(JSON.stringify(data), { status: 200 }), 5);
  manager.start();
  await new Promise((resolve) => setTimeout(resolve, 25));
  manager.stop();
  assert.equal(edits, 1);
});

test("a missing configured message creates one replacement instead of failing", async () => {
  let sends = 0;
  const channel = { isSendable: () => true, isTextBased: () => true, messages: { fetch: async (id?: string | object) => { if (typeof id === "string") throw new Error("missing"); return { find: () => undefined }; } }, send: async () => { sends += 1; return { id: "created" }; } };
  const guild = { channels: { fetch: async () => channel }, client: { user: { id: "bot" } } } as unknown as Guild;
  const manager = new LeaderboardManager(guild, { channelId: "111111111111111111", messageId: "222222222222222222" }, config, async () => new Response(JSON.stringify(data), { status: 200 }));
  assert.equal(await manager.refresh(true), true);
  assert.equal(sends, 1);
});
