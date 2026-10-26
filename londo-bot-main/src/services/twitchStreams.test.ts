import assert from "node:assert/strict";
import test from "node:test";
import { ComponentType, type ChatInputCommandInteraction, type Guild } from "discord.js";
import { createStreamAnnouncement, handleTwitchCommand, normalizeTwitchLogin, sendTestStream, TwitchApi, TwitchSiteStore, TwitchStreamWatcher, type TwitchProfile } from "./twitchStreams.js";

const twitchConfig = { clientId: "client", clientSecret: "secret", famMentionRoleId: "111111111111111111", streamChannelId: "222222222222222222" };
const siteConfig = { apiSecret: "site-secret", siteUrl: "http://127.0.0.1:3000" };
const profile: TwitchProfile = { discordUserId: "333333333333333333", state: null, twitchLogin: "vafelion", twitchUserId: "twitch-user" };
const stream = { game_name: "GTA V", id: "stream-1", started_at: "2026-09-05T10:00:00.000Z", thumbnail_url: "https://image/{width}x{height}.jpg", title: "Live @everyone", user_id: "twitch-user", user_login: "vafelion", viewer_count: 0 };

test("normalizes Twitch logins from plain values, @mentions, and URLs", () => {
  assert.equal(normalizeTwitchLogin(" Vafelion "), "vafelion");
  assert.equal(normalizeTwitchLogin("@Vafelion"), "vafelion");
  assert.equal(normalizeTwitchLogin("https://www.twitch.tv/Vafelion"), "vafelion");
  assert.equal(normalizeTwitchLogin("https://example.test/vafelion"), null);
  assert.equal(normalizeTwitchLogin("bad login"), null);
});

test("announcement uses explicit allowed mentions and a Twitch link button", () => {
  const payload = createStreamAnnouncement(profile, stream, { id: "twitch-user", login: "vafelion", profile_image_url: "https://image/avatar.png" }, twitchConfig.famMentionRoleId);
  const embed = payload.embeds[0]?.toJSON();
  const button = payload.components[0]?.toJSON().components[0];
  assert.deepEqual(payload.allowedMentions, { parse: [], roles: [twitchConfig.famMentionRoleId], users: [profile.discordUserId] });
  assert.match(payload.content, /<@&111111111111111111>/);
  assert.match(embed?.fields?.find((field) => field.name === "Игра")?.value ?? "", /GTA V/);
  assert.equal(embed?.fields?.find((field) => field.name === "Зрители")?.value, "0");
  assert.equal(button?.type, ComponentType.Button);
  assert.equal((button as { url?: string } | undefined)?.url, "https://www.twitch.tv/vafelion");
  assert.doesNotThrow(() => createStreamAnnouncement(profile, { ...stream, thumbnail_url: undefined }, undefined, twitchConfig.famMentionRoleId));
});

test("site store uses protected profile add and remove contracts", async () => {
  const requests: Request[] = [];
  const store = new TwitchSiteStore(siteConfig, async (input, init) => {
    requests.push(new Request(input, init));
    return Response.json({ ok: true });
  });
  const member = { displayName: "Vafelion", id: profile.discordUserId, user: { displayAvatarURL: () => "https://cdn.discordapp.com/avatar.png", username: "vafelion" } };
  assert.equal(await store.saveProfile(member as never, { id: "twitch-user", login: "vafelion" }), true);
  assert.equal(await store.removeProfile(profile.discordUserId), true);
  assert.equal(requests[0]?.url, "http://127.0.0.1:3000/api/internal/twitch/profiles");
  assert.equal(requests[1]?.url, `http://127.0.0.1:3000/api/internal/twitch/profiles/${profile.discordUserId}`);
  assert.equal(requests[0]?.headers.get("x-londo-bot-secret"), "site-secret");
});

test("watcher announces a new stream once, skips the same stream, and persists offline state", async () => {
  const sends: unknown[] = [];
  const states: unknown[] = [];
  const watcher = new TwitchStreamWatcher(
    { channels: { fetch: async () => ({ isSendable: () => true, isTextBased: () => true, send: async (payload: unknown) => { sends.push(payload); } }) } } as unknown as Guild,
    twitchConfig,
    siteConfig,
    {
      api: {} as TwitchApi,
      store: {
        saveState: async (_id: string, state: unknown) => { states.push(state); },
      } as unknown as TwitchStreamWatcher["store"],
    },
  );
  await watcher.updateProfile(profile, stream, { id: "twitch-user", login: "vafelion" });
  await watcher.updateProfile({ ...profile, state: states[0] as TwitchProfile["state"] }, stream, { id: "twitch-user", login: "vafelion" });
  await watcher.updateProfile({ ...profile, state: states[1] as TwitchProfile["state"] }, undefined, undefined);
  assert.equal(sends.length, 1);
  assert.equal((states[2] as { isLive: boolean }).isLive, false);
});

test("watcher handles an unavailable stream channel and poll failures without crashing", async () => {
  const states: unknown[] = [];
  const watcher = new TwitchStreamWatcher(
    { channels: { fetch: async () => null } } as unknown as Guild,
    twitchConfig,
    siteConfig,
    { api: { streamsByLogins: async () => new Map(), usersByLogins: async () => new Map() } as unknown as TwitchApi, store: { profiles: async () => { throw new Error("offline"); }, saveState: async (_id: string, state: unknown) => { states.push(state); } } as unknown as TwitchStreamWatcher["store"] },
  );
  await watcher.updateProfile(profile, stream, undefined);
  await watcher.poll();
  assert.equal(states.length, 1);
});

test("test stream uses the invoking user and profile login without changing stream state", async () => {
  const sent: Array<ReturnType<typeof createStreamAnnouncement>> = [];
  const user = { id: profile.discordUserId };
  const result = await sendTestStream(
    { channels: { fetch: async () => ({ isSendable: () => true, isTextBased: () => true, send: async (payload: ReturnType<typeof createStreamAnnouncement>) => { sent.push(payload); } }) } } as unknown as Guild,
    user as never,
    twitchConfig,
    async () => [profile],
  );
  assert.equal(result, "SENT");
  assert.equal(sent.length, 1);
  assert.match(sent[0]?.content ?? "", new RegExp(`<@${profile.discordUserId}>`));
  assert.equal(sent[0]?.embeds[0]?.toJSON().footer?.text, "Twitch • vafelion");
  assert.deepEqual(sent[0]?.allowedMentions, { parse: [], roles: [twitchConfig.famMentionRoleId], users: [profile.discordUserId] });
});

test("test-stream is administrator-only and handles missing channels safely", async () => {
  const replies: string[] = [];
  const base = {
    commandName: "test-stream", guild: { channels: { fetch: async () => null } }, user: { id: profile.discordUserId },
    reply: async (payload: { content: string }) => { replies.push(payload.content); },
  };
  await handleTwitchCommand({ ...base, memberPermissions: { has: () => false } } as unknown as ChatInputCommandInteraction, { announcementConfig: twitchConfig, watcher: null });
  await handleTwitchCommand({ ...base, memberPermissions: { has: () => true } } as unknown as ChatInputCommandInteraction, { announcementConfig: null, watcher: null });
  await handleTwitchCommand({ ...base, memberPermissions: { has: () => true } } as unknown as ChatInputCommandInteraction, { announcementConfig: twitchConfig, watcher: null });
  assert.match(replies[0] ?? "", /только администраторам/);
  assert.match(replies[1] ?? "", /TWITCH_STREAM_CHANNEL_ID/);
  assert.match(replies[2] ?? "", /Канал стримов недоступен/);
});

test("Twitch API refreshes its in-memory app token once after a 401", async () => {
  let tokenRequests = 0;
  let streamRequests = 0;
  const fetchImplementation = async (input: string | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes("oauth2/token")) { tokenRequests += 1; return Response.json({ access_token: `token-${tokenRequests}`, expires_in: 3600 }); }
    streamRequests += 1;
    return streamRequests === 1 ? new Response(null, { status: 401 }) : Response.json({ data: [stream] });
  };
  const api = new TwitchApi(twitchConfig, fetchImplementation);
  const result = await api.streamsByLogins(["vafelion"]);
  assert.equal(result.get("vafelion")?.id, "stream-1");
  assert.equal(tokenRequests, 2);
  assert.equal(streamRequests, 2);
});
