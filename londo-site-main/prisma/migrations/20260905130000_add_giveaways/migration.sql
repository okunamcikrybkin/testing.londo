-- Additive giveaway management tables. This migration does not alter or remove existing data.
CREATE TYPE "GiveawayStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "GiveawayFamily" AS ENUM ('MEMPHIS', 'PHOENIX', 'ALL');

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

CREATE TABLE "giveaway_participants" (
    "id" TEXT NOT NULL,
    "giveaway_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "giveaway_participants_pkey" PRIMARY KEY ("id")
);

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

CREATE UNIQUE INDEX "giveaway_participants_giveaway_id_discord_user_id_key" ON "giveaway_participants"("giveaway_id", "discord_user_id");
CREATE UNIQUE INDEX "giveaway_winners_giveaway_id_discord_user_id_key" ON "giveaway_winners"("giveaway_id", "discord_user_id");
CREATE INDEX "giveaways_status_ends_at_idx" ON "giveaways"("status", "ends_at");
CREATE INDEX "giveaways_family_created_at_idx" ON "giveaways"("family", "created_at");
CREATE INDEX "giveaway_participants_giveaway_id_joined_at_idx" ON "giveaway_participants"("giveaway_id", "joined_at");
CREATE INDEX "giveaway_winners_giveaway_id_position_is_rerolled_idx" ON "giveaway_winners"("giveaway_id", "position", "is_rerolled");
CREATE INDEX "giveaway_draw_events_giveaway_id_created_at_idx" ON "giveaway_draw_events"("giveaway_id", "created_at");

ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "giveaway_participants" ADD CONSTRAINT "giveaway_participants_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "giveaway_winners" ADD CONSTRAINT "giveaway_winners_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "giveaway_draw_events" ADD CONSTRAINT "giveaway_draw_events_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "giveaway_draw_events" ADD CONSTRAINT "giveaway_draw_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
