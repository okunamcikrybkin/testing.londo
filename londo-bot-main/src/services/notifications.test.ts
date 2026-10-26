import test from "node:test";
import assert from "node:assert/strict";
import { ChannelType, Collection, type Guild } from "discord.js";
import { ApplicationNotifications, notificationMessage } from "./notifications.js";

const channels = { MEMPHIS: "800000000000000001", PHOENIX: "800000000000000002" };
const items = (["MEMPHIS", "PHOENIX"] as const).flatMap((family) => ["join", "promotion", "vacation"].map((kind) => ({ eventId: family + kind, family, channelId: channels[family], roleId: null, title: family + kind, path: `/${family.toLowerCase()}/`, userId: "800000000000000010" })));

test("notification is an embed with a claim link and no exposed internal event IDs", () => {
  const payload = notificationMessage({ ...items[0], kindLabel: "Заявка", roleId: "800000000000000099" }, "https://londo.test");
  assert.deepEqual(payload.allowedMentions, { parse: [], roles: ["800000000000000099"], users: [] });
  assert.match(payload.content, /<@&800000000000000099>/);
  assert.equal((payload.components[0].components[0].data as { label?: string }).label, "Открыть заявку");
  assert.equal((payload.components[0].components[0].data as { url?: string }).url, "https://londo.test/memphis/?claim=1");
  assert.doesNotMatch(JSON.stringify(payload), /Ссылка на заявку|londo-notification:/);
  assert.throws(() => notificationMessage({ ...items[0], path: "https://other.test" }, "https://londo.test"));
});

test("claimed notification edits the original message into a work-in-progress embed", () => {
  const payload = notificationMessage({ ...items[0], claim: { reviewerId: "800000000000000099", reviewerName: "Иван Рекрутов" } }, "https://londo.test");
  assert.match(payload.content, /<@800000000000000099>/);
  assert.match(payload.embeds[0].data.title ?? "", /В работе/);
  assert.deepEqual(payload.components, []);
  assert.deepEqual(payload.allowedMentions, { parse: [], roles: [], users: ["800000000000000099"] });
});

test("resolved notification edits the original message into a decision embed", () => {
  const payload = notificationMessage({ ...items[0], resolution: { status: "REJECTED", reviewerId: "800000000000000099", reviewerName: "Иван Рекрутов", reason: "Недостаточно данных", resolvedAt: "2026-10-16T10:00:00.000Z" } }, "https://londo.test");
  assert.match(payload.content, /<@800000000000000099>/);
  assert.match(payload.embeds[0].data.title ?? "", /Рассмотрено/);
  assert.match(JSON.stringify(payload.embeds[0].data.fields), /Недостаточно данных/);
  assert.deepEqual(payload.components, []);
});

test("six notifications preserve family channels and retries recover sent messages", async () => {
  const sent: { family: string; content: string }[] = [], ack: string[] = [];
  const channelMap = new Map(Object.entries(channels).map(([family, id]) => { const messages = new Collection<string, { id: string; content: string; nonce: string; author: { id: string } }>(); return [id, { id, type: ChannelType.GuildText, permissionsFor: () => ({ has: () => true }), messages: { fetch: async () => messages }, send: async (payload: { content: string; nonce: string }) => { assert.ok(payload.content.includes(family)); const message = { id: String(sent.length + 1), content: payload.content, nonce: payload.nonce, author: { id: "bot" } }; messages.set(message.id, message); sent.push({ family, content: payload.content }); return message; } }]; }));
  const guild = { id: "guild", client: { user: { id: "bot" } }, members: { fetchMe: async () => ({}) }, channels: { fetch: async (id: string) => channelMap.get(id) } } as unknown as Guild;
  class Manager extends ApplicationNotifications { override async request<T>(body: object): Promise<T> { const value = body as { operation: string; eventId: string; family: string; channelId: string }; if (value.operation === "QUEUE") return items as T; assert.equal(value.channelId, channels[value.family as keyof typeof channels]); ack.push(value.eventId); return {} as T; } }
  const manager = new Manager(guild, { siteUrl: "https://londo.test", apiSecret: "test" });
  await Promise.all([manager.tick(), manager.tick()]);
  assert.equal(sent.length, 6); await manager.tick(); assert.equal(sent.length, 6); assert.equal(ack.length, 12);
});
