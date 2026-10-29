import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { ChannelType, PermissionFlagsBits, type Guild, type GuildMember, type Role } from "discord.js";
import { acceptRoleIdsForFamily, applicationCallOverwrites, applyAcceptedApplicationChanges, cleanupApplicationChannels, createApplicantNotification, isExpectedTextChannel, isExpectedVoiceChannel, isValidRejectionReason, startApplicationServer, type CleanupOperations, validateApplicationPayload } from "./applicationServer.js";
import type { ApplicationConfig } from "../types/family.js";

const roles = { fam: "1", memphis: "2", phoenix: "3" };
const apiConfig: ApplicationConfig = { applicationChannelId: "channel", callCategoryId: "category", port: 0, staffRoleIds: { MEMPHIS: [], PHOENIX: [] }, acceptRoleIds: { MEMPHIS: [], PHOENIX: [] } };
const application = { id: "app-1", family: "MEMPHIS" as const, discordUserId: "applicant", discordUsername: "member", discordDisplayName: "Member", discordTextChannelId: "text", discordVoiceChannelId: "voice" };

type TestChannel = { type: ChannelType; topic?: string; parentId?: string; permissionOverwrites?: { cache: { has(id: string): boolean } }; delete(reason?: string): Promise<unknown>; permissionsFor(): { has(): boolean }; };

function textChannel(onDelete?: () => Promise<void>): TestChannel {
  return { type: ChannelType.GuildText, topic: "londo-application:app-1", delete: async () => { await onDelete?.(); }, permissionsFor: () => ({ has: () => true }) };
}

function voiceChannel(onDelete?: () => Promise<void>): TestChannel {
  return { type: ChannelType.GuildVoice, parentId: "category", permissionOverwrites: { cache: { has: (id: string) => id === "applicant" } }, delete: async () => { await onDelete?.(); }, permissionsFor: () => ({ has: () => true }) };
}

function cleanupOperations(channels: Record<string, TestChannel | null | Error>, deleted: string[], canManageChannels = true): CleanupOperations {
  return {
    fetchChannel: async (id) => { const channel = channels[id]; if (channel instanceof Error) throw channel; return channel ?? null; },
    canManageChannels: () => canManageChannels,
    canAccessChannel: () => true,
    deleteChannel: async (channel) => { await channel.delete(); deleted.push(channel.type === ChannelType.GuildText ? "text" : "voice"); },
  };
}

test("cleanup binding accepts only this application's text and voice channels", () => {
  assert.equal(isExpectedTextChannel({ type: ChannelType.GuildText, topic: "londo-application:app-1" }, "app-1"), true);
  assert.equal(isExpectedTextChannel({ type: ChannelType.GuildText, topic: "londo-application:other" }, "app-1"), false);
  const voice = { type: ChannelType.GuildVoice, parentId: "category", permissionOverwrites: { cache: { has: (id: string) => id === "applicant" } } };
  assert.equal(isExpectedVoiceChannel(voice, "category", "applicant"), true);
  assert.equal(isExpectedVoiceChannel(voice, "category", "other"), false);
});

test("missing channel IDs are safe no-op inputs and rejection requires a non-empty trimmed value", () => {
  assert.equal(isValidRejectionReason(undefined), false);
  assert.equal(isValidRejectionReason("         "), false);
  assert.equal(isValidRejectionReason("A"), true);
  assert.equal(isValidRejectionReason("Нет"), true);
  assert.equal(isValidRejectionReason("  Причина  "), true);
});

test("Site Start Call JSON contract is accepted and reports invalid field names without values", () => {
  const payload = {
    application: {
      id: "app-1",
      family: "MEMPHIS",
      discordUserId: "123456789012345678",
      discordUsername: "member",
      discordDisplayName: "Member",
      discordTextChannelId: null,
      discordVoiceChannelId: null,
    },
  };

  assert.equal(validateApplicationPayload(payload.application, "app-1", "call").ok, true);
  const invalid = validateApplicationPayload({ ...payload.application, discordUserId: null }, "app-1", "call");
  assert.deepEqual(invalid, {
    ok: false,
    issues: [{ field: "discordUserId", expected: "string: 17-20 digit Discord snowflake", kind: "invalid" }],
  });
});

test("call channel permissions let the bot send messages and embeds despite the everyone deny", () => {
  const overwrites = applicationCallOverwrites("guild", "bot", "applicant", ["staff"]);
  assert.deepEqual(overwrites[0], { id: "guild", deny: [PermissionFlagsBits.ViewChannel] });
  assert.deepEqual(overwrites[1], {
    id: "bot",
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
    ],
  });
  assert.deepEqual(overwrites[2], {
    id: "applicant",
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
  });
  assert.deepEqual(overwrites[3], {
    id: "staff",
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
  });
});

test("operation-specific validation requires a rejection reason only for reject", () => {
  const application = {
    id: "app-1",
    family: "MEMPHIS",
    discordUserId: "123456789012345678",
    discordUsername: "member",
    discordDisplayName: "Member",
    discordTextChannelId: null,
    discordVoiceChannelId: null,
  };

  assert.equal(validateApplicationPayload(application, "app-1", "call").ok, true);
  assert.equal(validateApplicationPayload({ ...application, rejectionReason: null }, "app-1", "call").ok, true);
  assert.equal(validateApplicationPayload({ ...application, gameNicknameStatic: "Player | 123" }, "app-1", "accept").ok, true);
  assert.equal(validateApplicationPayload(application, "app-1", "accept").ok, false);
  assert.equal(validateApplicationPayload({ ...application, gameNicknameStatic: "Н".repeat(33) }, "app-1", "accept").ok, false);
  assert.equal(validateApplicationPayload({ ...application, gameNicknameStatic: "Player | 123", rejectionReason: null }, "app-1", "accept").ok, true);
  assert.equal(validateApplicationPayload(application, "app-1", "reject").ok, false);
  assert.equal(validateApplicationPayload({ ...application, rejectionReason: "" }, "app-1", "reject").ok, false);
  assert.equal(validateApplicationPayload({ ...application, rejectionReason: "   " }, "app-1", "reject").ok, false);
  assert.equal(validateApplicationPayload({ ...application, rejectionReason: "А" }, "app-1", "reject").ok, true);
  assert.equal(validateApplicationPayload({ ...application, rejectionReason: "А".repeat(1001) }, "app-1", "reject").ok, false);
});

test("rejection notice is human-readable and omits the website application ID", () => {
  const notification = createApplicantNotification({
    ...application,
    id: "cmvtbbow60018qekgxy6ag87w",
    discordDisplayName: "Player",
    rejectionReason: "Пожалуйста, подробнее расскажите о персонаже.",
  }, "REJECTED").toJSON();
  const text = JSON.stringify(notification);
  assert.match(text, /Мы внимательно рассмотрели вашу анкету/);
  assert.match(text, /Пожалуйста, подробнее расскажите о персонаже/);
  assert.doesNotMatch(text, /cmvtbbow60018qekgxy6ag87w/);
  assert.doesNotMatch(text, /Заявка cmvt/);
  assert.equal(notification.footer, undefined);
});

test("acceptance applies the requested Discord nickname along with roles", async () => {
  const assigned: string[] = [];
  const removed: string[] = [];
  let nickname = "";
  const member = {
    id: "applicant-1",
    roles: {
      cache: new Map(),
      add: async (role: { id: string }) => { assigned.push(role.id); },
      remove: async (id: string) => { removed.push(id); },
    },
    setNickname: async (value: string) => { nickname = value; },
  };
  await applyAcceptedApplicationChanges(
    member as unknown as Pick<GuildMember, "id" | "roles" | "setNickname">,
    [{ id: "role-1" }] as unknown as Role[],
    "Player | 123",
  );
  assert.equal(nickname, "Player | 123");
  assert.deepEqual(assigned, ["role-1"]);
  assert.deepEqual(removed, []);
});

test("acceptance rolls back newly added roles if Discord rejects the nickname", async () => {
  const removed: string[] = [];
  const member = {
    id: "applicant-1",
    roles: {
      cache: new Map(),
      add: async () => undefined,
      remove: async (id: string) => { removed.push(id); },
    },
    setNickname: async () => { throw new Error("nickname not permitted"); },
  };
  await assert.rejects(
    applyAcceptedApplicationChanges(
      member as unknown as Pick<GuildMember, "id" | "roles" | "setNickname">,
      [{ id: "role-1" }] as unknown as Role[],
      "Player",
    ),
    { message: "NICKNAME_UPDATE_FAILED" },
  );
  assert.deepEqual(removed, ["role-1"]);
});

test("accept role lists are family-specific and always include FAM plus family role", () => {
  assert.deepEqual(acceptRoleIdsForFamily("MEMPHIS", roles, ["4"]), ["1", "2", "4"]);
  assert.deepEqual(acceptRoleIdsForFamily("PHOENIX", roles, ["5"]), ["1", "3", "5"]);
});

test("cleanup deletes both owned channels and waits for each deletion", async () => {
  const deleted: string[] = [];
  const result = await cleanupApplicationChannels(application, "category", cleanupOperations({ text: textChannel(), voice: voiceChannel() }, deleted));
  assert.deepEqual(result, { text: "deleted", voice: "deleted" });
  assert.deepEqual(deleted, ["text", "voice"]);
});

test("cleanup treats either missing channel and both missing channels as successful", async () => {
  const textOnly = await cleanupApplicationChannels(application, "category", cleanupOperations({ text: textChannel(), voice: null }, []));
  assert.deepEqual(textOnly, { text: "deleted", voice: "already_absent" });
  const voiceOnly = await cleanupApplicationChannels(application, "category", cleanupOperations({ text: null, voice: voiceChannel() }, []));
  assert.deepEqual(voiceOnly, { text: "already_absent", voice: "deleted" });
  const neither = await cleanupApplicationChannels(application, "category", cleanupOperations({ text: null, voice: null }, []));
  assert.deepEqual(neither, { text: "already_absent", voice: "already_absent" });
});

test("cleanup fails safely when text or voice ownership does not match", async () => {
  await assert.rejects(cleanupApplicationChannels(application, "category", cleanupOperations({ text: { ...textChannel(), topic: "londo-application:other" }, voice: voiceChannel() }, [])), { message: "CHANNEL_OWNERSHIP_MISMATCH" });
  await assert.rejects(cleanupApplicationChannels(application, "category", cleanupOperations({ text: textChannel(), voice: { ...voiceChannel(), parentId: "other" } }, [])), { message: "CHANNEL_OWNERSHIP_MISMATCH" });
});

test("cleanup returns a structured failure when text or voice deletion fails", async () => {
  await assert.rejects(cleanupApplicationChannels(application, "category", cleanupOperations({ text: textChannel(async () => { throw new Error("delete failed"); }), voice: voiceChannel() }, [])), { message: "CHANNEL_DELETE_FAILED" });
  await assert.rejects(cleanupApplicationChannels(application, "category", cleanupOperations({ text: textChannel(), voice: voiceChannel(async () => { throw new Error("delete failed"); }) }, [])), { message: "CHANNEL_DELETE_FAILED" });
});

test("cleanup returns a structured failure when a channel fetch fails", async () => {
  await assert.rejects(cleanupApplicationChannels(application, "category", cleanupOperations({ text: new Error("fetch failed"), voice: voiceChannel() }, [])), { message: "CHANNEL_FETCH_FAILED" });
});

test("cleanup reports missing permissions before deletion", async () => {
  await assert.rejects(cleanupApplicationChannels(application, "category", cleanupOperations({ text: textChannel(), voice: voiceChannel() }, [], false)), { message: "MISSING_PERMISSIONS" });
});

test("internal API starts a local listener without creating a Discord client", async () => {
  const server = startApplicationServer({} as Guild, apiConfig, roles, "test-secret");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected the internal API to use a TCP listener.");
  }
  assert.ok(address.port > 0);
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
