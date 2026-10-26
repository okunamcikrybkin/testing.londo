import assert from "node:assert/strict";
import test from "node:test";
import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { createWelcomeMessage, sendWelcome, testWelcome } from "./welcome.js";

const config = { applicationChannelId: "111111111111111111", channelId: "222222222222222222" };
function member(bot = false): GuildMember {
  return { displayName: "Vafelion", guild: { memberCount: 970 }, id: "926534588023590922", user: { bot, username: "vafelion" } } as unknown as GuildMember;
}
function channel(sent: unknown[]): { isSendable(): boolean; isTextBased(): boolean; send(payload: unknown): Promise<void> } {
  return { isSendable: () => true, isTextBased: () => true, send: async (payload) => { sent.push(payload); } };
}

test("human join sends one welcome with application mention and current member count", async () => {
  const sent: unknown[] = [];
  assert.equal(await sendWelcome(member(), config, { assetExists: false, channel: channel(sent) }), true);
  assert.equal(sent.length, 1);
  const payload = sent[0] as ReturnType<typeof createWelcomeMessage>;
  const description = payload.embeds[0]?.toJSON().description ?? "";
  assert.match(description, /<@926534588023590922>/);
  assert.match(description, /<#111111111111111111>/);
  assert.match(description, /Всего участников — 970/);
  assert.equal(payload.files.length, 0);
});

test("bot accounts, missing channels, and unavailable channels do not crash", async () => {
  assert.equal(await sendWelcome(member(true), config), false);
  assert.equal(await sendWelcome(member(), { applicationChannelId: null, channelId: null }), false);
  assert.equal(await sendWelcome(member(), config, { channel: null }), false);
});

test("welcome message includes the local attachment when the asset exists", () => {
  const payload = createWelcomeMessage(member(), 3, null, true);
  assert.equal(payload.files.length, 1);
  assert.equal(payload.embeds[0]?.toJSON().image?.url, "attachment://londo-welcome.png");
  assert.match(payload.embeds[0]?.toJSON().description ?? "", /Подавай заявку в разделе заявок/);
});

test("test-welcome permits administrators and denies non-admins", async () => {
  const replies: Array<{ content: string }> = [];
  const admin = { guild: {}, member: member(), memberPermissions: { has: () => true }, reply: async (payload: { content: string }) => { replies.push(payload); } } as unknown as ChatInputCommandInteraction;
  await testWelcome(admin, { applicationChannelId: null, channelId: null });
  assert.match(replies[0]?.content ?? "", /Не удалось отправить/);
  const denied = { memberPermissions: { has: () => false }, reply: async (payload: { content: string }) => { replies.push(payload); } } as unknown as ChatInputCommandInteraction;
  await testWelcome(denied, config);
  assert.match(replies[1]?.content ?? "", /только администраторам/);
});
