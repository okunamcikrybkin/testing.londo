-- Separate normalized Discord/domain events from existing website AuditLog records.
CREATE TYPE "LogEventCategory" AS ENUM ('APPLICATION', 'RANK', 'PROMOTION', 'AFK', 'VACATION', 'BALANCE', 'SYSTEM');
CREATE TYPE "LogEventType" AS ENUM ('APPLICATION_CREATED', 'APPLICATION_CALL_STARTED', 'APPLICATION_ACCEPTED', 'APPLICATION_REJECTED', 'RANK_CHANGED', 'PROMOTION_CREATED', 'PROMOTION_ACCEPTED', 'PROMOTION_REJECTED', 'AFK_STARTED', 'AFK_ENDED', 'VACATION_STARTED', 'VACATION_ENDED', 'BALANCE_CHANGED', 'SYSTEM_EVENT');
CREATE TYPE "LogEventSource" AS ENUM ('LONDO_BOT');

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

CREATE UNIQUE INDEX "log_events_source_source_event_id_key" ON "log_events"("source", "source_event_id");
CREATE INDEX "log_events_created_at_id_idx" ON "log_events"("created_at", "id");
CREATE INDEX "log_events_family_created_at_idx" ON "log_events"("family", "created_at");
CREATE INDEX "log_events_category_created_at_idx" ON "log_events"("category", "created_at");
CREATE INDEX "log_events_actor_discord_id_created_at_idx" ON "log_events"("actor_discord_id", "created_at");
CREATE INDEX "log_events_target_discord_id_created_at_idx" ON "log_events"("target_discord_id", "created_at");
