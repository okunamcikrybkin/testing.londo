-- Additive Twitch mapping and durable announcement state for the LONDO Bot.
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

CREATE UNIQUE INDEX "twitch_profiles_discord_user_id_key" ON "twitch_profiles"("discord_user_id");
CREATE UNIQUE INDEX "twitch_profiles_twitch_login_key" ON "twitch_profiles"("twitch_login");
CREATE UNIQUE INDEX "twitch_profiles_twitch_user_id_key" ON "twitch_profiles"("twitch_user_id");
CREATE INDEX "twitch_profiles_enabled_twitch_login_idx" ON "twitch_profiles"("enabled", "twitch_login");
CREATE INDEX "twitch_stream_states_is_live_last_checked_at_idx" ON "twitch_stream_states"("is_live", "last_checked_at");

ALTER TABLE "twitch_profiles" ADD CONSTRAINT "twitch_profiles_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "twitch_stream_states" ADD CONSTRAINT "twitch_stream_states_discord_identity_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "twitch_stream_states" ADD CONSTRAINT "twitch_stream_states_profile_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "twitch_profiles"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE;
