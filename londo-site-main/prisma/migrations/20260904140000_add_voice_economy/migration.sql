-- Add durable global voice/economy data without altering existing users, memberships, or balances.
CREATE TYPE "EconomyTransactionType" AS ENUM ('CREDIT');
CREATE TYPE "EconomyTransactionReason" AS ENUM ('VOICE');
CREATE TYPE "EconomyTransactionSource" AS ENUM ('VOICE_TRACKER');

CREATE TABLE "voice_profiles" (
  "discord_user_id" TEXT NOT NULL, "total_voice_seconds" BIGINT NOT NULL DEFAULT 0,
  "balance" DECIMAL(20,4) NOT NULL DEFAULT 0, "xp" INTEGER NOT NULL DEFAULT 0,
  "voice_seconds_remainder" INTEGER NOT NULL DEFAULT 0, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("discord_user_id")
);
CREATE TABLE "voice_active_sessions" (
  "id" TEXT NOT NULL, "discord_user_id" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "segment_started_at" TIMESTAMP(3) NOT NULL, "last_checkpoint_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voice_active_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "voice_active_sessions_discord_user_id_key" UNIQUE ("discord_user_id"),
  CONSTRAINT "voice_active_sessions_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "voice_profiles"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "economy_transactions" (
  "id" TEXT NOT NULL, "discord_user_id" TEXT NOT NULL, "amount" DECIMAL(20,4) NOT NULL,
  "type" "EconomyTransactionType" NOT NULL, "reason" "EconomyTransactionReason" NOT NULL,
  "source" "EconomyTransactionSource" NOT NULL, "source_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "economy_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "economy_transactions_source_id_key" UNIQUE ("source_id"),
  CONSTRAINT "economy_transactions_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "voice_profiles"("discord_user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "economy_transactions_discord_user_id_created_at_idx" ON "economy_transactions"("discord_user_id", "created_at");
