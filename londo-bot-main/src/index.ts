import { startDiscordCheckRetention } from "./services/discordCheckRetention.js";
import { BirthdayManager } from "./services/birthdays.js";
import { accessRolesChanged, observeAccess, reconcileAccess, sendAccessObservations } from "./services/accessSync.js";
import { ApplicationNotifications } from "./services/notifications.js";
import { factionRolesManager, type FactionRolesManager } from "./services/factionRoles.js";
import { promotionsManager, type PromotionsManager } from "./services/promotions.js";
import { Events, type Client, type Guild, type GuildMember, type PartialGuildMember } from "discord.js";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { loadApplicationConfig, loadDiscordConfig, loadGuideConfig, loadInternalApiSecret, loadLeaderboardConfig, loadTwitchAnnouncementConfig, loadTwitchConfig, loadVoiceConfig, loadWelcomeConfig } from "./config/discord.js";
import { loadSiteLogConfig } from "./config/siteLogs.js";
import { createDiscordClient } from "./discord.js";
import { FamilyRoleNotFoundError, getConfiguredGuild, GuildNotFoundError } from "./services/guild.js";
import { getFamilyMembers, getFamilyRoster } from "./services/members.js";
import { ensureApplicationPanel, handleApplicationInteraction, publishApplicationPanel, registerApplicationCommand } from "./services/applicationPanel.js";
import { bootstrapInternalApi } from "./services/internalApiBootstrap.js";
import { sendLogEvent } from "./services/siteLogs.js";
import { syncFamilyRoster } from "./services/rosterSync.js";
import { syncRosterMember } from "./services/memberRosterSync.js";
import { MemberSyncScheduler } from "./services/memberSyncScheduler.js";
import { nicknameGuard } from "./services/nicknameGuard.js";
import { resolveNicknameActor } from "./services/nicknameAudit.js";
import { sendVoiceOperation } from "./services/voiceClient.js";
import { VoiceTracker } from "./services/voiceTracker.js";
import { LeaderboardManager, setupLeaderboard } from "./services/leaderboard.js";
import { checkWelcomeChannel, sendLeave, sendWelcome, testWelcome } from "./services/welcome.js";
import { publishGuide } from "./services/guide.js";
import { handleTwitchCommand, TwitchStreamWatcher, twitchCommandDefinitions } from "./services/twitchStreams.js";
import { AfkManager } from "./services/afk.js";
import { ShopManager } from "./services/shop.js";
import { GiveawayManager } from "./services/giveaways.js";
import { describeDiscordError, logError, logInfo, logWarning } from "./utils/logger.js";

function safeLifecycleError(error: unknown): string {
  if (error instanceof Error) return error.name;
  return "unknown error";
}

function installLifecycleDiagnostics(getState: () => { discordReady: boolean; internalApiListening: boolean }): void {
  process.on("beforeExit", (code) => {
    const state = getState();
    const resources = typeof process.getActiveResourcesInfo === "function" ? process.getActiveResourcesInfo().join(", ") || "none" : "unavailable";
    logWarning(`Lifecycle beforeExit: code ${code}; Discord ready: ${state.discordReady}; Internal API listening: ${state.internalApiListening}; active resources: ${resources}.`);
  });
  process.on("exit", (code) => {
    const state = getState();
    logWarning(`Lifecycle exit: code ${code}; Discord ready: ${state.discordReady}; Internal API listening: ${state.internalApiListening}.`);
  });
  process.on("uncaughtException", (error) => {
    logError(`Lifecycle uncaughtException: ${safeLifecycleError(error)}.`);
    process.exitCode = 1;
  });
  process.on("unhandledRejection", (reason) => {
    logError(`Lifecycle unhandledRejection: ${safeLifecycleError(reason)}.`);
    process.exitCode = 1;
  });
}

function installGracefulShutdown(client: Client, getServer: () => Server | null, checkpointVoice: () => Promise<void>): void {
  let shuttingDown = false;

  const shutdown = (signal: "SIGINT" | "SIGTERM") => {
    if (shuttingDown) return;
    shuttingDown = true;
    void (async () => {
      logInfo(`Graceful shutdown started: ${signal}.`);
      try {
        await checkpointVoice();
        const server = getServer();
        if (server?.listening) {
          await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        }
        client.destroy();
        logInfo("Graceful shutdown completed.");
      } catch (error) {
        logError(`Graceful shutdown failed: ${safeLifecycleError(error)}.`);
        process.exitCode = 1;
      }
    })();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

function voiceCandidates(guild: Guild) {
  return guild.members.cache.map((member) => ({ channelId: member.voice.channelId, deaf: Boolean(member.voice.deaf), member, mute: Boolean(member.voice.mute), participantCount: member.voice.channel?.members.size ?? 0 }));
}

function hasRosterRelevantChange(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember | PartialGuildMember): boolean {
  const oldRoles = [...oldMember.roles.cache.keys()].sort().join(",");
  const newRoles = [...newMember.roles.cache.keys()].sort().join(",");
  return oldRoles !== newRoles || oldMember.nickname !== newMember.nickname || oldMember.displayName !== newMember.displayName;
}

function logStartupError(error: unknown): void {
  if (error instanceof GuildNotFoundError) {
    logError("Guild not found.");
    return;
  }

  if (error instanceof FamilyRoleNotFoundError) {
    logError(`${error.roleName} role not found.`);
    return;
  }

  logError(describeDiscordError(error));
}

async function start(): Promise<void> {
  const config = loadDiscordConfig();
  const siteLogConfig = loadSiteLogConfig();
  const voiceConfig = loadVoiceConfig();
  const leaderboardConfig = loadLeaderboardConfig();
  const welcomeConfig = loadWelcomeConfig();
  const guideConfig = loadGuideConfig();
  let twitchConfig = null;
  let twitchAnnouncementConfig = null;
  try { twitchConfig = loadTwitchConfig(config.roles.fam); } catch { logWarning("[TWITCH] Configuration is incomplete; watcher disabled."); }
  try { twitchAnnouncementConfig = loadTwitchAnnouncementConfig(config.roles.fam); } catch { logWarning("[TWITCH] Announcement configuration is invalid; test command disabled."); }
  const client = createDiscordClient();
  const startupId = randomUUID();
  let internalApiServer: Server | null = null;
  let voiceTracker: VoiceTracker | null = null;
  let voiceCheckpoint: NodeJS.Timeout | null = null;
  let rosterReconciliation: NodeJS.Timeout | null = null;
  let memberSyncScheduler: MemberSyncScheduler | null = null;
  let leaderboardManager: LeaderboardManager | null = null;
  let twitchWatcher: TwitchStreamWatcher | null = null;
  let promotions: PromotionsManager | null = null;
  let factionRoles: FactionRolesManager | null = null;
  let notifications: ApplicationNotifications | null = null;
  let afkManager: AfkManager | null = null;
  let shopManager: ShopManager | null = null;
  let giveawayManager: GiveawayManager | null = null;
  let birthdayManager: BirthdayManager | null = null;
  installLifecycleDiagnostics(() => ({ discordReady: client.isReady(), internalApiListening: internalApiServer?.listening ?? false }));
  installGracefulShutdown(client, () => internalApiServer, async () => { if (voiceCheckpoint) clearInterval(voiceCheckpoint); if (rosterReconciliation) clearInterval(rosterReconciliation); memberSyncScheduler?.dispose(); leaderboardManager?.stop(); twitchWatcher?.stop(); birthdayManager?.stop(); giveawayManager?.stop(); shopManager?.stop(); afkManager?.stop(); promotions?.stop(); notifications?.stop(); if (voiceTracker) await voiceTracker.checkpoint(); });

  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    if (newMember.guild.id !== config.guildId) return;
    if (siteLogConfig && (oldMember.partial || accessRolesChanged(oldMember.roles.cache.keys(), newMember.roles.cache.keys()))) {
      const observedAt = new Date().toISOString();
      if (newMember.partial) {
        void newMember.fetch().then(member => sendAccessObservations(siteLogConfig, [observeAccess(member, "ROLE_UPDATE", observedAt)])).catch(() => logWarning("[ACCESS] Partial member unavailable; no access change applied."));
      } else {
        void sendAccessObservations(siteLogConfig, [observeAccess(newMember, "ROLE_UPDATE", observedAt)]);
      }
    }
    void nicknameGuard.handleUpdate(oldMember, newMember, config.roles, () => resolveNicknameActor(newMember.guild, newMember.id), client.user?.id ?? null);
    if (voiceTracker) void voiceTracker.reconcile(voiceCandidates(newMember.guild));
    if (memberSyncScheduler && hasRosterRelevantChange(oldMember, newMember)) {
      if (newMember.partial) {
        void newMember.fetch().then((member) => memberSyncScheduler?.schedule(member)).catch(() => logWarning("[ROSTER] Unable to fetch partial member for sync."));
      } else {
        memberSyncScheduler.schedule(newMember);
      }
    }
  });
  client.on(Events.VoiceStateUpdate, (_oldState, newState) => { if (newState.guild.id === config.guildId && voiceTracker) void voiceTracker.reconcile(voiceCandidates(newState.guild)); });
  client.on(Events.GuildMemberAdd, (member) => {
    if (member.guild.id !== config.guildId) return;
    if (siteLogConfig) void sendAccessObservations(siteLogConfig, [observeAccess(member, "ROLE_UPDATE")]);
    if (siteLogConfig) void sendLogEvent(siteLogConfig, {
      type: "MEMBER_JOINED",
      sourceEventId: `member-joined:${member.id}:${member.joinedTimestamp ?? Date.now()}`,
      serverId: member.guild.id,
      summary: `${member.displayName} вошёл на сервер Discord.`,
      target: { discordId: member.id, username: member.user.username, displayName: member.displayName },
      metadata: { serverName: member.guild.name },
      occurredAt: member.joinedAt?.toISOString(),
    });
    void sendWelcome(member, welcomeConfig);
  });

  client.on(Events.GuildMemberRemove, member => {
    if (member.guild.id !== config.guildId) return;
    void sendLeave(member, welcomeConfig);
    if (siteLogConfig) {
      const occurredAt = new Date().toISOString();
      void sendAccessObservations(siteLogConfig, [{ discordId: member.id, roleIds: [], observedAt: occurredAt, trigger: "ROLE_UPDATE" }]);
      void sendLogEvent(siteLogConfig, {
        type: "MEMBER_LEFT",
        sourceEventId: `member-left:${member.id}:${occurredAt}:${randomUUID()}`,
        serverId: member.guild.id,
        summary: `${member.displayName} покинул сервер Discord.`,
        target: { discordId: member.id, username: member.user.username, displayName: member.displayName },
        metadata: { serverName: member.guild.name },
        occurredAt,
      });
    }
  });

  client.on(Events.GuildAuditLogEntryCreate, (entry, guild) => {
    if (!siteLogConfig || guild.id !== config.guildId) return;
    const executor = entry.executor;
    const targetData = entry.target && typeof entry.target === "object" ? entry.target as { username?: string; globalName?: string | null; displayName?: string; name?: string } : null;
    const executorName = executor?.globalName ?? executor?.username ?? "Discord";
    const targetName = targetData?.displayName ?? targetData?.globalName ?? targetData?.username ?? targetData?.name ?? null;
    void sendLogEvent(siteLogConfig, {
      type: "SYSTEM_EVENT",
      sourceEventId: `discord-audit:${entry.id}`,
      serverId: guild.id,
      summary: `${executorName}: действие Discord ${entry.actionType.toLocaleLowerCase("ru-RU")} · ${entry.targetType}${targetName ? ` · ${targetName}` : ""}`,
      ...(executor ? { actor: { discordId: executor.id, username: executor.username ?? executorName, displayName: executorName } } : {}),
      ...(entry.targetId ? { target: { discordId: entry.targetId, username: targetName ?? entry.targetType, displayName: targetName ?? entry.targetType } } : {}),
      metadata: {
        event: "DISCORD_AUDIT_LOG_ENTRY",
        action: String(entry.action),
        actionType: entry.actionType,
        targetType: entry.targetType,
        reason: (entry.reason ?? "").slice(0, 500),
        changedFields: entry.changes.map((change) => change.key).join(", ").slice(0, 500),
      },
      occurredAt: entry.createdAt.toISOString(),
    });
  });

  client.once(Events.ClientReady, async (readyClient) => {
    try {
      const guild = await getConfiguredGuild(readyClient, config);
      // Fetch the guild roster once, then filter the active family from the same snapshot.
      const accessObservedAt = new Date().toISOString();
      const members = await guild.members.fetch();
      if (siteLogConfig) {
        const accessSnapshot = [...members.values()].map(member => observeAccess(member, "STARTUP_RECONCILIATION", accessObservedAt));
        void reconcileAccess(siteLogConfig, accessSnapshot, guild.memberCount, accessObservedAt, "STARTUP_RECONCILIATION").catch(() => logWarning("[ACCESS] Startup reconciliation failed."));
      }
      const memphisMembers = getFamilyMembers(members.values(), "MEMPHIS", config.roles);
      const memphisRoster = getFamilyRoster(members.values(), "MEMPHIS", config.roles);
      for (const member of memphisRoster) {
        if (!member.rank) logWarning(`Roster member has no configured rank: family ${member.family}; Discord ID ${member.discordUserId}.`);
      }

      logInfo("Connected successfully.");
      logInfo(`Guild: ${guild.name}`);
      logInfo("MEMPHIS role: found.");
      logInfo("FAM role: found.");
      logInfo(`Readable members: ${guild.members.cache.size}; roles: ${guild.roles.cache.size}.`);
      logInfo(`MEMPHIS roster count: ${memphisMembers.length}.`);
      await checkWelcomeChannel(guild, welcomeConfig);

      let applicationConfig = null;
      try {
        applicationConfig = loadApplicationConfig();
        await ensureApplicationPanel(guild, applicationConfig.applicationChannelId).catch(() => logWarning("[Applications] Не удалось обновить виджет заявок."));
        if (applicationConfig.staffRoleIds.MEMPHIS.length === 0) logWarning("MEMPHIS staff roles are not configured.");
        const internalApiSecret = loadInternalApiSecret();
        afkManager = siteLogConfig ? new AfkManager(guild, siteLogConfig, config.roles) : null;
        if (siteLogConfig) startDiscordCheckRetention(siteLogConfig);
        notifications = siteLogConfig ? new ApplicationNotifications(guild, siteLogConfig) : null;
        factionRoles = siteLogConfig ? factionRolesManager(guild, siteLogConfig) : null;
        promotions = siteLogConfig ? promotionsManager(guild, siteLogConfig, config.roles, applicationConfig) : null;
        await promotions?.catalog().catch(() => logWarning("Promotion rank catalog unavailable at startup."));
        shopManager = siteLogConfig ? new ShopManager(guild, siteLogConfig) : null;
        giveawayManager = siteLogConfig ? new GiveawayManager(guild, config.roles, siteLogConfig) : null;
        internalApiServer = bootstrapInternalApi(guild, applicationConfig, config.roles, internalApiSecret, (event) => {
          if (!siteLogConfig) return;
          void sendLogEvent(siteLogConfig, {
            sourceEventId: `application:${event.type.toLowerCase()}:${event.application.id}`,
            type: event.type,
            family: event.application.family,
            serverId: guild.id,
            discordChannelId: event.channelId,
            summary: `Application ${event.type.toLowerCase().replaceAll("_", " ")}.`,
            target: { discordId: event.application.discordUserId, username: event.application.discordUsername, displayName: event.application.discordDisplayName },
            metadata: { applicationId: event.application.id },
          });
        }, undefined, giveawayManager);
      } catch (error) {
        logError(error instanceof Error ? `Internal API failed to start: ${error.message}` : "Internal API failed to start: configuration error.");
      }

      try {
        await registerApplicationCommand(guild, [...twitchCommandDefinitions, { name: "setup-promotions", description: "Обновить панели повышений LONDO" }, { name: "setup-afk", description: "Опубликовать панель Отпуск", defaultMemberPermissions: "8" }]);
      } catch (error) {
        logWarning(error instanceof Error ? `Application command registration failed: ${error.name}` : "Application command registration failed.");
      }

        readyClient.on(Events.InteractionCreate, async (interaction) => {
        try {
          if (notifications && await notifications.handleInteraction(interaction)) return;
          if (interaction.isChatInputCommand() && interaction.commandName === "setup-applications") {
            if (!applicationConfig) { await interaction.reply({ content: "Flow заявок не настроен: проверьте application ENV variables.", ephemeral: true }); return; }
            await publishApplicationPanel(interaction, applicationConfig.applicationChannelId);
            return;
          }
          if (interaction.isChatInputCommand() && interaction.commandName === "setup-leaderboard") {
            await setupLeaderboard(interaction, leaderboardManager);
            return;
          }
          if (interaction.isChatInputCommand() && interaction.commandName === "test-welcome") {
            await testWelcome(interaction, welcomeConfig);
            return;
          }
          if (interaction.isChatInputCommand() && interaction.commandName === "setup-guide") {
            await publishGuide(interaction, guideConfig);
            return;
          }
          if (interaction.isChatInputCommand() && await handleTwitchCommand(interaction, { announcementConfig: twitchAnnouncementConfig, watcher: twitchWatcher })) return;
          if (factionRoles && await factionRoles.handleInteraction(interaction)) return;
          if (promotions && await promotions.handleInteraction(interaction)) return;
          if (afkManager && await afkManager.handleInteraction(interaction)) return;
          if (shopManager && await shopManager.handleInteraction(interaction)) return;
          if (giveawayManager && await giveawayManager.handleInteraction(interaction)) return;
          await handleApplicationInteraction(interaction);
        } catch {
          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: "Не удалось обработать действие. Попробуйте ещё раз позже.", ephemeral: true });
        }
      });

      if (!siteLogConfig) {
        logWarning("Site log delivery is not configured; Discord bot will continue without it.");
        return;
      }

      birthdayManager = new BirthdayManager(guild, siteLogConfig);
      birthdayManager.start();

      if (twitchConfig) {
        twitchWatcher = new TwitchStreamWatcher(guild, twitchConfig, siteLogConfig);
        twitchWatcher.start();
      }
      giveawayManager?.start();
      shopManager?.start();
      afkManager?.start();
      promotions?.start();
      notifications?.start();

      memberSyncScheduler = new MemberSyncScheduler(async (member) => {
        await syncRosterMember(siteLogConfig, guild.id, member, config.roles);
      });

      if (leaderboardConfig.channelId) {
        leaderboardManager = new LeaderboardManager(guild, leaderboardConfig, siteLogConfig);
        await leaderboardManager.refresh();
        leaderboardManager.start();
      } else {
        logWarning("[LEADERBOARD] LEADERBOARD_CHANNEL_ID is not configured.");
      }

      voiceTracker = new VoiceTracker({
        reconcile: async (ids) => { if (!await sendVoiceOperation(siteLogConfig, { operation: "RECONCILE", activeDiscordUserIds: ids })) logWarning("[VOICE] Recovery sync failed."); },
        start: async (discordUserId) => { if (!await sendVoiceOperation(siteLogConfig, { operation: "START", discordUserId })) logWarning("[VOICE] Session start failed."); },
        settle: async (discordUserId, keepActive) => { if (!await sendVoiceOperation(siteLogConfig, { operation: "SETTLE", discordUserId, keepActive })) logWarning("[VOICE] Session settlement failed."); },
      }, config.roles, voiceConfig);
      await voiceTracker.reconcile(voiceCandidates(guild), true);
      voiceCheckpoint = setInterval(() => { if (voiceTracker) void voiceTracker.checkpoint(); }, 60_000);
      voiceCheckpoint.unref();
      logInfo("[VOICE] Tracker initialized.");
      logInfo(`[VOICE] Active sessions: ${voiceTracker.activeCount}.`);

      await Promise.all([
        syncFamilyRoster(siteLogConfig, guild.id, "MEMPHIS", getFamilyRoster(members.values(), "MEMPHIS", config.roles)),
      ]);

      const reconcileRoster = async (): Promise<void> => {
        const observedAt = new Date().toISOString();
        const snapshot = await guild.members.fetch();
        const accessSnapshot = [...snapshot.values()].map(member => observeAccess(member, "PERIODIC_RECONCILIATION", observedAt));
        await reconcileAccess(siteLogConfig, accessSnapshot, guild.memberCount, observedAt, "PERIODIC_RECONCILIATION");
        await Promise.all([
          syncFamilyRoster(siteLogConfig, guild.id, "MEMPHIS", getFamilyRoster(snapshot.values(), "MEMPHIS", config.roles)),
        ]);
      };
      rosterReconciliation = setInterval(() => {
        void reconcileRoster().catch(() => logWarning("[ROSTER] Full reconciliation failed."));
      }, 300_000);
      rosterReconciliation.unref();

      await sendLogEvent(siteLogConfig, {
        sourceEventId: `startup:${startupId}:bot-started`,
        summary: "LONDO Bot started and completed guild validation.",
        serverId: guild.id,
        metadata: { event: "BOT_STARTED", guildName: guild.name, readableMemberCount: guild.members.cache.size, roleCount: guild.roles.cache.size },
      });
      await sendLogEvent(siteLogConfig, {
        sourceEventId: `startup:${startupId}:roster-snapshot`,
        summary: "LONDO Bot read a family roster snapshot.",
        serverId: guild.id,
        metadata: { event: "ROSTER_SNAPSHOT_READ", memphisCount: getFamilyMembers(guild.members.cache.values(), "MEMPHIS", config.roles).length, totalReadableMembers: guild.members.cache.size },
      });
    } catch (error) {
      logStartupError(error);
      process.exitCode = 1;
      logWarning("Discord client is being destroyed after failed startup.");
      client.destroy();
    }
  });

  client.on(Events.Error, (error) => {
    logError(describeDiscordError(error));
  });
  client.on(Events.ShardDisconnect, () => {
    logWarning("Discord gateway disconnected.");
  });

  try {
    await client.login(config.botToken);
  } catch (error) {
    logError(describeDiscordError(error));
    process.exitCode = 1;
  }
}

void start().catch((error) => {
  if (error instanceof Error && error.message.startsWith("Missing required environment variable:")) {
    logError(error.message);
    process.exitCode = 1;
    return;
  }

  logError("Bot startup failed. Check local configuration.");
  process.exitCode = 1;
});
