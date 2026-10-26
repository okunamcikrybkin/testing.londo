-- Add bot-owned Discord identities and independent family memberships without altering existing data.
ALTER TYPE "LogEventType" ADD VALUE IF NOT EXISTS 'ROSTER_RANK_CHANGED';
CREATE TABLE "discord_identities" (
  "discord_user_id" TEXT NOT NULL, "username" TEXT NOT NULL, "display_name" TEXT NOT NULL, "avatar_url" TEXT, "game_nickname" TEXT, "static_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "discord_identities_pkey" PRIMARY KEY ("discord_user_id")
);
CREATE TABLE "family_memberships" (
  "id" TEXT NOT NULL, "discord_user_id" TEXT NOT NULL, "family" "Family" NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "rank_key" TEXT, "rank_display_name" TEXT, "rank_role_id" TEXT, "rank_priority" INTEGER, "last_synced_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "family_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "family_memberships_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "family_memberships_discord_user_id_family_key" ON "family_memberships"("discord_user_id", "family");
CREATE INDEX "family_memberships_family_active_rank_priority_idx" ON "family_memberships"("family", "active", "rank_priority");
