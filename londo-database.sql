-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'RECRUIT', 'HIGH_STAFF', 'OWNER');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "Family" AS ENUM ('MEMPHIS', 'PHOENIX');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'CALL', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GiveawayStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GiveawayFamily" AS ENUM ('MEMPHIS', 'PHOENIX', 'ALL');

-- CreateEnum
CREATE TYPE "LogEventCategory" AS ENUM ('APPLICATION', 'RANK', 'PROMOTION', 'AFK', 'VACATION', 'BALANCE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LogEventType" AS ENUM ('APPLICATION_CREATED', 'APPLICATION_CALL_STARTED', 'APPLICATION_ACCEPTED', 'APPLICATION_REJECTED', 'RANK_CHANGED', 'ROSTER_RANK_CHANGED', 'PROMOTION_CREATED', 'PROMOTION_ACCEPTED', 'PROMOTION_REJECTED', 'AFK_STARTED', 'AFK_ENDED', 'VACATION_STARTED', 'VACATION_ENDED', 'BALANCE_CHANGED', 'SYSTEM_EVENT');

-- CreateEnum
CREATE TYPE "EconomyTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "EconomyTransactionReason" AS ENUM ('ADMIN_GRANT', 'ADMIN_DEBIT', 'ROULETTE_SPIN', 'ROULETTE_REWARD', 'VOICE', 'SHOP_PURCHASE', 'SHOP_REFUND');

-- CreateEnum
CREATE TYPE "EconomyTransactionSource" AS ENUM ('ADMIN', 'ROULETTE', 'VOICE_TRACKER', 'SHOP');

-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShopItemType" AS ENUM ('MANUAL', 'DISCORD_ROLE');

-- CreateEnum
CREATE TYPE "ShopPurchaseStatus" AS ENUM ('PENDING_FULFILLMENT', 'COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LogEventSource" AS ENUM ('LONDO_BOT');

-- CreateEnum
CREATE TYPE "AfkApplicationStatus" AS ENUM ('PENDING', 'APPROVING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ENDED');

-- CreateEnum
CREATE TYPE "AfkSessionStatus" AS ENUM ('GRANTING', 'ACTIVE', 'ENDING', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RoulettePrizeType" AS ENUM ('COINS', 'DISCORD_ROLE', 'MANUAL', 'NOTHING');

-- CreateEnum
CREATE TYPE "RouletteSpinType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "RouletteSpinStatus" AS ENUM ('COMPLETED', 'PENDING_FULFILLMENT', 'PENDING_DELIVERY', 'FAILED');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('PENDING', 'APPROVING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PromotionQuestionType" AS ENUM ('SHORT', 'PARAGRAPH');

-- CreateTable
CREATE TABLE "discord_identities" (
    "discord_user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "game_nickname" TEXT,
    "static_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_identities_pkey" PRIMARY KEY ("discord_user_id")
);

-- CreateTable
CREATE TABLE "twitch_profiles" (
    "id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "twitch_login" TEXT NOT NULL,
    "twitch_user_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitch_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twitch_stream_states" (
    "discord_user_id" TEXT NOT NULL,
    "twitch_user_id" TEXT,
    "current_stream_id" TEXT,
    "announced_stream_id" TEXT,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "last_seen_online_at" TIMESTAMP(3),
    "last_seen_offline_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitch_stream_states_pkey" PRIMARY KEY ("discord_user_id")
);

-- CreateTable
CREATE TABLE "voice_profiles" (
    "discord_user_id" TEXT NOT NULL,
    "total_voice_seconds" BIGINT NOT NULL DEFAULT 0,
    "balance" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "voice_seconds_remainder" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("discord_user_id")
);

-- CreateTable
CREATE TABLE "voice_active_sessions" (
    "id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "segment_started_at" TIMESTAMP(3) NOT NULL,
    "last_checkpoint_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_active_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_transactions" (
    "metadata" JSONB,
    "id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "type" "EconomyTransactionType" NOT NULL,
    "reason" "EconomyTransactionReason" NOT NULL,
    "source" "EconomyTransactionSource" NOT NULL,
    "source_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economy_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_shop_settings" (
    "id" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "title" TEXT NOT NULL DEFAULT '🛒 Магазин семьи',
    "description" TEXT NOT NULL DEFAULT 'Магазин открыт. Покупай товары через кнопки справа.',
    "closed_text" TEXT,
    "status" "ShopStatus" NOT NULL DEFAULT 'OPEN',
    "discord_channel_id" TEXT,
    "discord_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(20,4) NOT NULL,
    "type" "ShopItemType" NOT NULL,
    "discord_role_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_purchases" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "price" DECIMAL(20,4) NOT NULL,
    "type" "ShopItemType" NOT NULL,
    "status" "ShopPurchaseStatus" NOT NULL DEFAULT 'PENDING_FULFILLMENT',
    "completed_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "fulfilled_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_memberships" (
    "id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rank_key" TEXT,
    "rank_display_name" TEXT,
    "rank_role_id" TEXT,
    "rank_priority" INTEGER,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_access_snapshots" (
    "role_ids" JSONB NOT NULL DEFAULT '[]',
    "user_id" TEXT NOT NULL,
    "memphis_role" "UserRole" NOT NULL DEFAULT 'USER',
    "phoenix_role" "UserRole" NOT NULL DEFAULT 'USER',
    "observed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_access_snapshots_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "staff_access_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "memphis_role" "UserRole" NOT NULL DEFAULT 'USER',
    "phoenix_role" "UserRole" NOT NULL DEFAULT 'USER',
    "source_request_id" TEXT,
    "granted_by_user_id" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" TEXT,
    "revoke_reason" TEXT,

    CONSTRAINT "staff_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_access_credentials" (
    "user_id" TEXT NOT NULL,
    "pin_hash" TEXT,
    "pin_set_at" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "credential_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_access_credentials_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "users" (
    "ui_theme" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "id" TEXT NOT NULL,
    "discord_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar" TEXT,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_access_requests" (
    "memphis_role" "UserRole" NOT NULL DEFAULT 'USER',
    "phoenix_role" "UserRole" NOT NULL DEFAULT 'USER',
    "discord_role_ids" JSONB NOT NULL DEFAULT '[]',
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requested_role" "UserRole" NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "staff_pin_verified_at" TIMESTAMP(3),
    "staff_pin_credential_version" INTEGER,
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_events" (
    "id" TEXT NOT NULL,
    "source" "LogEventSource" NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "type" "LogEventType" NOT NULL,
    "category" "LogEventCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT,
    "family" "Family",
    "server_id" TEXT,
    "actor_user_id" TEXT,
    "actor_discord_id" TEXT,
    "actor_username" TEXT,
    "actor_display_name" TEXT,
    "target_user_id" TEXT,
    "target_discord_id" TEXT,
    "target_username" TEXT,
    "target_display_name" TEXT,
    "discord_channel_id" TEXT,
    "discord_message_id" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_applications" (
    "id" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "discord_username" TEXT NOT NULL,
    "discord_display_name" TEXT NOT NULL,
    "discord_avatar" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "answers" JSONB NOT NULL,
    "rejection_reason" TEXT,
    "reviewed_by_user_id" TEXT,
    "call_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "discord_text_channel_id" TEXT,
    "discord_voice_channel_id" TEXT,
    "operation_lock" TEXT,
    "operation_locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaways" (
    "id" TEXT NOT NULL,
    "family" "GiveawayFamily" NOT NULL,
    "status" "GiveawayStatus" NOT NULL DEFAULT 'DRAFT',
    "prize" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "discord_channel_id" TEXT NOT NULL,
    "required_role_id" TEXT,
    "mention_role_id" TEXT,
    "winner_count" INTEGER NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "discord_message_id" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "giveaways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaway_participants" (
    "id" TEXT NOT NULL,
    "giveaway_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaway_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaway_winners" (
    "id" TEXT NOT NULL,
    "giveaway_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_rerolled" BOOLEAN NOT NULL DEFAULT false,
    "rerolled_at" TIMESTAMP(3),

    CONSTRAINT "giveaway_winners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaway_draw_events" (
    "id" TEXT NOT NULL,
    "giveaway_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "position" INTEGER,
    "previous_winner_id" TEXT,
    "winner_id" TEXT,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaway_draw_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "afk_applications" (
    "id" TEXT NOT NULL,
    "request_key" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "reason" TEXT NOT NULL,
    "requested_start_at" TIMESTAMP(3) NOT NULL,
    "requested_end_at" TIMESTAMP(3) NOT NULL,
    "status" "AfkApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_discord_id" TEXT,
    "rejection_reason" TEXT,
    "approved_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "afk_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "afk_sessions" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "discord_role_id" TEXT NOT NULL,
    "status" "AfkSessionStatus" NOT NULL DEFAULT 'GRANTING',
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "ended_by_discord_id" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "afk_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roulette_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paidSpinPrice" DECIMAL(20,4) NOT NULL DEFAULT 25,
    "freeSpinCooldownHours" INTEGER NOT NULL DEFAULT 24,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roulette_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roulette_prizes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "RoulettePrizeType" NOT NULL,
    "weight" INTEGER NOT NULL,
    "coinAmount" DECIMAL(20,4),
    "discordRoleId" TEXT,
    "manualText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roulette_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roulette_spins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "spinType" "RouletteSpinType" NOT NULL,
    "pricePaid" DECIMAL(20,4) NOT NULL,
    "status" "RouletteSpinStatus" NOT NULL,
    "requestId" TEXT NOT NULL,
    "prizeName" TEXT NOT NULL,
    "prizeType" "RoulettePrizeType" NOT NULL,
    "coinAmount" DECIMAL(20,4),
    "discordRoleId" TEXT,
    "manualText" TEXT,
    "wheelSnapshot" JSONB NOT NULL,
    "deliveryNote" TEXT,
    "fulfilledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "roulette_spins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_settings" (
    "family" "Family" NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Система повышений LONDO',
    "description" TEXT NOT NULL DEFAULT 'Выберите сервер и ранг, ознакомьтесь с критериями и подайте заявку.',
    "discordChannelId" TEXT,
    "discordMessageId" TEXT,
    "publishedChannelId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_settings_pkey" PRIMARY KEY ("family")
);

-- CreateTable
CREATE TABLE "promotion_ranks" (
    "id" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discordRoleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isPosition" BOOLEAN NOT NULL DEFAULT false,
    "removePreviousRank" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_ranks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_criteria" (
    "id" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_questions" (
    "id" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "type" "PromotionQuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "minLength" INTEGER,
    "maxLength" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_applications" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "rankId" TEXT NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'PENDING',
    "rankName" TEXT NOT NULL,
    "currentRank" TEXT,
    "identitySnapshot" JSONB NOT NULL,
    "criteriaSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "currentDiscordRoleIds" JSONB NOT NULL,
    "rolePlan" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByDiscordId" TEXT,
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "promotion_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_role_panel_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "channelId" TEXT,
    "messageId" TEXT,
    "publishedChannelId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Выдача ролей фракции',
    "description" TEXT NOT NULL DEFAULT 'Нажми на кнопку с названием фракции, чтобы получить или снять роль.',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_role_panel_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_role_buttons" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "discordRoleId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_role_buttons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_role_operations" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "buttonId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faction_role_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_notification_settings" (
    "family" "Family" NOT NULL,
    "channelId" TEXT,
    "applicationPingRoleId" TEXT,
    "promotionPingRoleId" TEXT,
    "vacationPingRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_notification_settings_pkey" PRIMARY KEY ("family")
);

-- CreateTable
CREATE TABLE "application_notification_receipts" (
    "eventId" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_notification_receipts_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "profile_customizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'DEFAULT',
    "accentColor" TEXT NOT NULL DEFAULT 'THEME',
    "bannerPreset" TEXT NOT NULL DEFAULT 'DEFAULT',
    "customBannerUrl" TEXT,
    "avatarFrame" TEXT NOT NULL DEFAULT 'NONE',
    "avatarFrameColor" TEXT,
    "profileTopColor" TEXT,
    "profileBottomColor" TEXT,
    "cardStyle" TEXT NOT NULL DEFAULT 'MATTE',
    "bio" TEXT NOT NULL DEFAULT '',
    "customStatus" TEXT NOT NULL DEFAULT '',
    "layout" TEXT NOT NULL DEFAULT 'CLASSIC',
    "showDiscordUsername" BOOLEAN NOT NULL DEFAULT true,
    "showDiscordId" BOOLEAN NOT NULL DEFAULT false,
    "showGameNickname" BOOLEAN NOT NULL DEFAULT true,
    "showStaticId" BOOLEAN NOT NULL DEFAULT false,
    "showFamily" BOOLEAN NOT NULL DEFAULT true,
    "showRank" BOOLEAN NOT NULL DEFAULT true,
    "showCoins" BOOLEAN NOT NULL DEFAULT false,
    "showVoiceTime" BOOLEAN NOT NULL DEFAULT false,
    "showGames" BOOLEAN NOT NULL DEFAULT true,
    "showSocialLinks" BOOLEAN NOT NULL DEFAULT true,
    "showBadges" BOOLEAN NOT NULL DEFAULT true,
    "selectedBadges" JSONB NOT NULL DEFAULT '[]',
    "games" JSONB NOT NULL DEFAULT '[]',
    "favoriteGame" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_customizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rank_appearances" (
    "roleId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rank_appearances_pkey" PRIMARY KEY ("roleId")
);

-- CreateTable
CREATE TABLE "DiscordGuildWatchlist" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordGuildWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordOAuthConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "credentials" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordOAuthConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordApplicationCheck" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "checkedByUserId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "matchedGuildIds" TEXT[],
    "resultSnapshot" JSONB,

    CONSTRAINT "DiscordApplicationCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "twitch_profiles_discord_user_id_key" ON "twitch_profiles"("discord_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "twitch_profiles_twitch_login_key" ON "twitch_profiles"("twitch_login");

-- CreateIndex
CREATE UNIQUE INDEX "twitch_profiles_twitch_user_id_key" ON "twitch_profiles"("twitch_user_id");

-- CreateIndex
CREATE INDEX "twitch_profiles_enabled_twitch_login_idx" ON "twitch_profiles"("enabled", "twitch_login");

-- CreateIndex
CREATE INDEX "twitch_stream_states_is_live_last_checked_at_idx" ON "twitch_stream_states"("is_live", "last_checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "voice_active_sessions_discord_user_id_key" ON "voice_active_sessions"("discord_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "economy_transactions_source_id_key" ON "economy_transactions"("source_id");

-- CreateIndex
CREATE INDEX "economy_transactions_discord_user_id_created_at_idx" ON "economy_transactions"("discord_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "family_shop_settings_family_key" ON "family_shop_settings"("family");

-- CreateIndex
CREATE INDEX "shop_items_family_is_active_sort_order_idx" ON "shop_items"("family", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "shop_purchases_family_status_created_at_idx" ON "shop_purchases"("family", "status", "created_at");

-- CreateIndex
CREATE INDEX "shop_purchases_discord_user_id_created_at_idx" ON "shop_purchases"("discord_user_id", "created_at");

-- CreateIndex
CREATE INDEX "family_memberships_family_active_rank_priority_idx" ON "family_memberships"("family", "active", "rank_priority");

-- CreateIndex
CREATE UNIQUE INDEX "family_memberships_discord_user_id_family_key" ON "family_memberships"("discord_user_id", "family");

-- CreateIndex
CREATE INDEX "staff_access_grants_user_id_revoked_at_idx" ON "staff_access_grants"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_discord_id_key" ON "users"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "staff_access_requests_user_id_status_idx" ON "staff_access_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "staff_access_requests_requested_role_status_created_at_idx" ON "staff_access_requests"("requested_role", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "log_events_created_at_id_idx" ON "log_events"("created_at", "id");

-- CreateIndex
CREATE INDEX "log_events_family_created_at_idx" ON "log_events"("family", "created_at");

-- CreateIndex
CREATE INDEX "log_events_category_created_at_idx" ON "log_events"("category", "created_at");

-- CreateIndex
CREATE INDEX "log_events_actor_discord_id_created_at_idx" ON "log_events"("actor_discord_id", "created_at");

-- CreateIndex
CREATE INDEX "log_events_target_discord_id_created_at_idx" ON "log_events"("target_discord_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "log_events_source_source_event_id_key" ON "log_events"("source", "source_event_id");

-- CreateIndex
CREATE INDEX "family_applications_family_status_created_at_idx" ON "family_applications"("family", "status", "created_at");

-- CreateIndex
CREATE INDEX "family_applications_discord_user_id_idx" ON "family_applications"("discord_user_id");

-- CreateIndex
CREATE INDEX "family_applications_reviewed_by_user_id_idx" ON "family_applications"("reviewed_by_user_id");

-- CreateIndex
CREATE INDEX "giveaways_status_ends_at_idx" ON "giveaways"("status", "ends_at");

-- CreateIndex
CREATE INDEX "giveaways_family_created_at_idx" ON "giveaways"("family", "created_at");

-- CreateIndex
CREATE INDEX "giveaway_participants_giveaway_id_joined_at_idx" ON "giveaway_participants"("giveaway_id", "joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "giveaway_participants_giveaway_id_discord_user_id_key" ON "giveaway_participants"("giveaway_id", "discord_user_id");

-- CreateIndex
CREATE INDEX "giveaway_winners_giveaway_id_position_is_rerolled_idx" ON "giveaway_winners"("giveaway_id", "position", "is_rerolled");

-- CreateIndex
CREATE UNIQUE INDEX "giveaway_winners_giveaway_id_discord_user_id_key" ON "giveaway_winners"("giveaway_id", "discord_user_id");

-- CreateIndex
CREATE INDEX "giveaway_draw_events_giveaway_id_created_at_idx" ON "giveaway_draw_events"("giveaway_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "afk_applications_request_key_key" ON "afk_applications"("request_key");

-- CreateIndex
CREATE INDEX "afk_applications_family_status_created_at_idx" ON "afk_applications"("family", "status", "created_at");

-- CreateIndex
CREATE INDEX "afk_applications_discord_user_id_family_idx" ON "afk_applications"("discord_user_id", "family");

-- CreateIndex
CREATE UNIQUE INDEX "afk_sessions_application_id_key" ON "afk_sessions"("application_id");

-- CreateIndex
CREATE INDEX "afk_sessions_status_end_at_idx" ON "afk_sessions"("status", "end_at");

-- CreateIndex
CREATE INDEX "afk_sessions_discord_user_id_family_idx" ON "afk_sessions"("discord_user_id", "family");

-- CreateIndex
CREATE INDEX "roulette_prizes_isActive_sortOrder_idx" ON "roulette_prizes"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "roulette_spins_userId_spinType_createdAt_idx" ON "roulette_spins"("userId", "spinType", "createdAt");

-- CreateIndex
CREATE INDEX "roulette_spins_status_createdAt_idx" ON "roulette_spins"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "roulette_spins_userId_requestId_key" ON "roulette_spins"("userId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_ranks_discordRoleId_key" ON "promotion_ranks"("discordRoleId");

-- CreateIndex
CREATE INDEX "promotion_ranks_family_isActive_sortOrder_idx" ON "promotion_ranks"("family", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_applications_requestKey_key" ON "promotion_applications"("requestKey");

-- CreateIndex
CREATE INDEX "promotion_applications_family_status_createdAt_idx" ON "promotion_applications"("family", "status", "createdAt");

-- CreateIndex
CREATE INDEX "promotion_applications_discordUserId_createdAt_idx" ON "promotion_applications"("discordUserId", "createdAt");

-- CreateIndex
CREATE INDEX "faction_role_buttons_panelId_sortOrder_idx" ON "faction_role_buttons"("panelId", "sortOrder");

-- CreateIndex
CREATE INDEX "faction_role_operations_discordUserId_buttonId_createdAt_idx" ON "faction_role_operations"("discordUserId", "buttonId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "family_notification_settings_channelId_key" ON "family_notification_settings"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "profile_customizations_userId_key" ON "profile_customizations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordGuildWatchlist_guildId_key" ON "DiscordGuildWatchlist"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordOAuthConsent_userId_key" ON "DiscordOAuthConsent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordOAuthConsent_discordId_key" ON "DiscordOAuthConsent"("discordId");

-- CreateIndex
CREATE INDEX "DiscordApplicationCheck_applicationId_checkedAt_idx" ON "DiscordApplicationCheck"("applicationId", "checkedAt");

-- CreateIndex
CREATE INDEX "DiscordApplicationCheck_expiresAt_idx" ON "DiscordApplicationCheck"("expiresAt");

-- AddForeignKey
ALTER TABLE "twitch_profiles" ADD CONSTRAINT "twitch_profiles_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitch_stream_states" ADD CONSTRAINT "twitch_stream_states_discord_identity_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twitch_stream_states" ADD CONSTRAINT "twitch_stream_states_profile_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "twitch_profiles"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_active_sessions" ADD CONSTRAINT "voice_active_sessions_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "voice_profiles"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_transactions" ADD CONSTRAINT "economy_transactions_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "voice_profiles"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_family_fkey" FOREIGN KEY ("family") REFERENCES "family_shop_settings"("family") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "shop_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "voice_profiles"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_fulfilled_by_id_fkey" FOREIGN KEY ("fulfilled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_access_snapshots" ADD CONSTRAINT "user_access_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_access_grants" ADD CONSTRAINT "staff_access_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_access_credentials" ADD CONSTRAINT "staff_access_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_access_requests" ADD CONSTRAINT "staff_access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_access_requests" ADD CONSTRAINT "staff_access_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_applications" ADD CONSTRAINT "family_applications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaway_participants" ADD CONSTRAINT "giveaway_participants_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaway_winners" ADD CONSTRAINT "giveaway_winners_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaway_draw_events" ADD CONSTRAINT "giveaway_draw_events_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaway_draw_events" ADD CONSTRAINT "giveaway_draw_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afk_applications" ADD CONSTRAINT "afk_applications_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afk_applications" ADD CONSTRAINT "afk_applications_reviewed_by_discord_id_fkey" FOREIGN KEY ("reviewed_by_discord_id") REFERENCES "users"("discord_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afk_sessions" ADD CONSTRAINT "afk_sessions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "afk_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afk_sessions" ADD CONSTRAINT "afk_sessions_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_spins" ADD CONSTRAINT "roulette_spins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_spins" ADD CONSTRAINT "roulette_spins_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "voice_profiles"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_spins" ADD CONSTRAINT "roulette_spins_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "roulette_prizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_criteria" ADD CONSTRAINT "promotion_criteria_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "promotion_ranks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_questions" ADD CONSTRAINT "promotion_questions_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "promotion_ranks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "promotion_ranks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "discord_identities"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_role_buttons" ADD CONSTRAINT "faction_role_buttons_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "faction_role_panel_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_customizations" ADD CONSTRAINT "profile_customizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordOAuthConsent" ADD CONSTRAINT "DiscordOAuthConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordApplicationCheck" ADD CONSTRAINT "DiscordApplicationCheck_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "family_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
