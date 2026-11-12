import assert from "node:assert/strict";
import test from "node:test";
import { ChannelType, Collection, OverwriteType, PermissionFlagsBits, PermissionsBitField, type Guild, type Interaction, type VoiceChannel, type VoiceState } from "discord.js";
import { createTemporaryVoicePanel, TEMPORARY_VOICE_CATEGORY_ID, TEMPORARY_VOICE_DELETE_DELAY_MS, TemporaryVoiceManager, temporaryVoiceOwnerId } from "./temporaryVoice.js";

test("temporary voice panel exposes all room controls across valid action rows", () => {
  const panel = createTemporaryVoicePanel();
  const serialized = JSON.stringify(panel);
  assert.match(serialized, /londo-temporary-voice-panel/);
  assert.match(serialized, /Зайдите в канал/);
  assert.match(serialized, /60 минут|1 минуту/);
  assert.match(serialized, /londo:tempvoice:rename/);
  assert.match(serialized, /londo:tempvoice:privacy/);
  assert.match(serialized, /londo:tempvoice:transfer/);
  assert.match(serialized, /londo:tempvoice:delete/);
  assert.equal(panel.components.length, 3);
  assert.deepEqual(panel.components.map((row) => row.components.length), [5, 5, 4]);
});

test("managed room owner is identified only by an explicit member permission overwrite", () => {
  const channel = {
    permissionOverwrites: {
      cache: new Collection([
        ["guild", {
          id: "guild",
          type: OverwriteType.Role,
          allow: new PermissionsBitField(),
          deny: new PermissionsBitField(),
        }],
        ["admin-role", {
          id: "admin-role",
          type: OverwriteType.Role,
          allow: new PermissionsBitField(PermissionFlagsBits.ManageChannels),
          deny: new PermissionsBitField(),
        }],
        ["owner", {
          id: "owner",
          type: OverwriteType.Member,
          allow: new PermissionsBitField(PermissionFlagsBits.ManageChannels),
          deny: new PermissionsBitField(),
        }],
      ]),
    },
  } as unknown as Pick<VoiceChannel, "permissionOverwrites">;

  assert.equal(temporaryVoiceOwnerId(channel), "owner");
});

test("room without a member management overwrite is not treated as a temporary room", () => {
  const channel = {
    permissionOverwrites: {
      cache: new Collection([
        ["member", {
          id: "member",
          type: OverwriteType.Member,
          allow: new PermissionsBitField(PermissionFlagsBits.Connect),
          deny: new PermissionsBitField(),
        }],
      ]),
    },
  } as unknown as Pick<VoiceChannel, "permissionOverwrites">;

  assert.equal(temporaryVoiceOwnerId(channel), null);
});

test("empty managed rooms are rechecked and deleted after the one-minute grace period", async () => {
  const timers: Array<{ callback: () => void; delay: number }> = [];
  let deleted = 0;
  const room = {
    id: "123456789012345678",
    type: ChannelType.GuildVoice,
    parentId: TEMPORARY_VOICE_CATEGORY_ID,
    members: new Collection(),
    permissionOverwrites: {
      cache: new Collection([
        ["owner", {
          id: "owner",
          type: OverwriteType.Member,
          allow: new PermissionsBitField(PermissionFlagsBits.ManageChannels),
          deny: new PermissionsBitField(),
        }],
      ]),
    },
    delete: async () => { deleted++; },
  } as unknown as VoiceChannel;
  const guild = {
    id: "guild",
    channels: { fetch: async (id: string) => id === room.id ? room : null },
  } as unknown as Guild;
  const manager = new TemporaryVoiceManager(guild);
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    timers.push({ callback, delay });
    return { unref() {} };
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;

  const oldState = { guild, channelId: room.id } as unknown as VoiceState;
  const newState = { guild, channelId: null } as unknown as VoiceState;
  const waitForDeletion = () => new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
  try {
    await manager.handleVoiceStateUpdate(oldState, newState);
    assert.equal(timers[0]?.delay, TEMPORARY_VOICE_DELETE_DELAY_MS);

    room.members.set("member", {} as never);
    timers[0]?.callback();
    await waitForDeletion();
    assert.equal(deleted, 0);

    room.members.clear();
    await manager.handleVoiceStateUpdate(oldState, newState);
    timers[1]?.callback();
    await waitForDeletion();
    assert.equal(deleted, 1);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    manager.stop();
  }
});

test("room name and participant limit forms read their configured input and apply changes", async () => {
  for (const [action, input, expected] of [
    ["rename", "Quiet-Room", "Quiet-Room"],
    ["limit", "7", 7],
  ] as const) {
    let updatedName = "";
    let updatedLimit = -1;
    const room = {
      id: "123456789012345678",
      type: ChannelType.GuildVoice,
      parentId: TEMPORARY_VOICE_CATEGORY_ID,
      permissionOverwrites: {
        cache: new Collection([
          ["owner", {
            id: "owner",
            type: OverwriteType.Member,
            allow: new PermissionsBitField(PermissionFlagsBits.ManageChannels),
            deny: new PermissionsBitField(),
          }],
        ]),
      },
      setName: async (name: string) => { updatedName = name; },
      setUserLimit: async (limit: number) => { updatedLimit = limit; },
    } as unknown as VoiceChannel;
    const member = { id: "owner", permissions: { has: () => false } };
    const guild = {
      id: "guild",
      members: { fetch: async () => member },
      channels: { fetch: async () => room },
    } as unknown as Guild;
    const manager = new TemporaryVoiceManager(guild);
    const replies: unknown[] = [];
    const interaction = {
      customId: `londo:tempvoice:modal:${action}:123456789012345678`,
      guild,
      user: { id: "owner" },
      fields: {
        getTextInputValue: (customId: string) => {
          assert.equal(customId, "value");
          return input;
        },
      },
      isButton: () => false,
      isUserSelectMenu: () => false,
      isStringSelectMenu: () => false,
      isModalSubmit: () => true,
      isRepliable: () => true,
      deferred: false,
      replied: false,
      deferReply: async () => undefined,
      editReply: async (reply: unknown) => { replies.push(reply); },
      reply: async (reply: unknown) => { replies.push(reply); },
      followUp: async (reply: unknown) => { replies.push(reply); },
    } as unknown as Interaction;

    assert.equal(await manager.handleInteraction(interaction), true);
    assert.equal(action === "rename" ? updatedName : updatedLimit, expected);
    assert.equal(replies.length, 1);
  }
});
