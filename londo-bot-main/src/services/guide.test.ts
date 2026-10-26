import assert from "node:assert/strict";
import test from "node:test";
import { ComponentType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { createGuidePanel, publishGuide } from "./guide.js";

const config = {
  applicationChannelId: "111111111111111111", channelId: "222222222222222222",
  channels: { guestChat: null, navigation: "333333333333333333", news: null, videos: null, voiceGuest: null },
  messageId: null, ownerName: "SENTICEE",
  urls: { application: "https://example.test/apply", law: "https://example.test/law", registration: "https://example.test/register", telegram: "https://example.test/telegram" },
};

function interaction(admin: boolean, channel: unknown, replies: Array<{ content: string }>): ChatInputCommandInteraction {
  return {
    client: { user: { id: "bot" } },
    guild: { channels: { fetch: async () => channel } },
    memberPermissions: { has: () => admin },
    reply: async (payload: { content: string }) => { replies.push(payload); },
  } as unknown as ChatInputCommandInteraction;
}

function componentsJson(panel: ReturnType<typeof createGuidePanel>) {
  return panel.components[0]?.toJSON();
}

test("guide panel is one Components V2 container with sections, accessories, media, and footer marker", () => {
  const panel = createGuidePanel(config, { logo: true, promo: true });
  const container = componentsJson(panel);
  const components = container?.components ?? [];
  const header = components[0];
  const usefulSections = components.filter((component) => component.type === ComponentType.Section).slice(1);

  assert.equal(panel.flags, MessageFlags.IsComponentsV2);
  assert.deepEqual(panel.embeds, []);
  assert.equal(panel.components.length, 1);
  assert.equal(container?.type, ComponentType.Container);
  assert.equal(header?.type, ComponentType.Section);
  assert.match(JSON.stringify(header), /Путеводитель по серверу LONDO/);
  assert.match(JSON.stringify(header), /londo-guide-logo\.png/);
  assert.equal(components.filter((component) => component.type === ComponentType.Separator).length, 2);
  assert.match(JSON.stringify(components), /<#333333333333333333>/);
  assert.match(JSON.stringify(components), /<#111111111111111111>/);
  assert.equal(usefulSections.length, 4);
  assert.match(JSON.stringify(usefulSections[0]), /Подать заявку/);
  assert.match(JSON.stringify(usefulSections[1]), /Регистрация/);
  assert.match(JSON.stringify(usefulSections[2]), /Памятка/);
  assert.match(JSON.stringify(usefulSections[3]), /Telegram/);
  assert.equal(components.filter((component) => component.type === ComponentType.MediaGallery).length, 1);
  assert.match(JSON.stringify(components), /londo-promo\.png/);
  assert.match(JSON.stringify(components), /LONDO BOT/);
  assert.equal(panel.files.length, 2);
  assert.equal(components.filter((component) => component.type === ComponentType.ActionRow).length, 0);
});

test("guide omits optional accessories and media without URLs or local assets", () => {
  const panel = createGuidePanel({
    ...config,
    applicationChannelId: null,
    channels: { guestChat: null, navigation: null, news: null, videos: null, voiceGuest: null },
    urls: { application: null, law: null, registration: null, telegram: null },
  }, { logo: false, promo: false });
  const container = componentsJson(panel);

  assert.equal(panel.files.length, 0);
  assert.equal(container?.components.filter((component) => component.type === ComponentType.MediaGallery).length, 0);
  assert.equal(JSON.stringify(container).includes("accessory"), false);
  assert.match(JSON.stringify(container), /Разделы пока не настроены/);
});

test("setup-guide creates once, then edits its marked Components V2 message", async () => {
  let created = 0;
  let edited = 0;
  const replies: Array<{ content: string }> = [];
  const message = {
    author: { id: "bot" }, embeds: [], components: [{ content: "LONDO BOT Путеводитель по серверу LONDO" }],
    edit: async () => { edited += 1; },
  };
  const channel = {
    isSendable: () => true, isTextBased: () => true,
    messages: { fetch: async () => ({ find: () => created ? message : undefined }) },
    send: async () => { created += 1; return { id: "new-guide" }; },
  };
  const request = interaction(true, channel, replies);

  await publishGuide(request, config, { logo: false, promo: false });
  await publishGuide(request, config, { logo: false, promo: false });

  assert.equal(created, 1);
  assert.equal(edited, 1);
  assert.match(replies[0]?.content ?? "", /опубликована/);
});

test("setup-guide replaces a legacy embed only when Components V2 conversion is rejected", async () => {
  let created = 0;
  let deleted = 0;
  const replies: Array<{ content: string }> = [];
  const legacy = {
    author: { id: "bot" },
    embeds: [{ footer: { text: "LONDO BOT" }, title: "Путеводитель по серверу LONDO" }], components: [],
    edit: async () => { throw new Error("CannotConvertLegacyMessage"); },
    delete: async () => { deleted += 1; },
  };
  const channel = {
    isSendable: () => true, isTextBased: () => true,
    messages: { fetch: async () => ({ find: () => legacy }) },
    send: async () => { created += 1; return { id: "replacement" }; },
  };

  await publishGuide(interaction(true, channel, replies), config, { logo: false, promo: false });

  assert.equal(deleted, 1);
  assert.equal(created, 1);
});

test("setup-guide denies non-admins, missing channels, and recreates deleted configured messages", async () => {
  const replies: Array<{ content: string }> = [];
  await publishGuide(interaction(false, null, replies), config, { logo: false, promo: false });
  await publishGuide(interaction(true, null, replies), { ...config, channelId: null }, { logo: false, promo: false });

  let created = 0;
  const channel = {
    isSendable: () => true, isTextBased: () => true,
    messages: { fetch: async (id?: string | object) => { if (typeof id === "string") throw new Error("missing"); return { find: () => undefined }; } },
    send: async () => { created += 1; return { id: "replacement" }; },
  };
  await publishGuide(interaction(true, channel, replies), { ...config, messageId: "444444444444444444" }, { logo: false, promo: false });

  assert.match(replies[0]?.content ?? "", /только администраторам/);
  assert.match(replies[1]?.content ?? "", /не настроен/);
  assert.equal(created, 1);
});
