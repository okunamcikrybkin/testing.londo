-- CreateEnum
CREATE TYPE "Family" AS ENUM ('MEMPHIS', 'PHOENIX');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'CALL', 'ACCEPTED', 'REJECTED');

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

-- CreateIndex
CREATE INDEX "family_applications_family_status_created_at_idx" ON "family_applications"("family", "status", "created_at");

-- CreateIndex
CREATE INDEX "family_applications_discord_user_id_idx" ON "family_applications"("discord_user_id");

-- CreateIndex
CREATE INDEX "family_applications_reviewed_by_user_id_idx" ON "family_applications"("reviewed_by_user_id");

-- AddForeignKey
ALTER TABLE "family_applications" ADD CONSTRAINT "family_applications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
