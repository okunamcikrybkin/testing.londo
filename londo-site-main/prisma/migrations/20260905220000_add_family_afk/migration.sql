-- CreateEnum
CREATE TYPE "AfkApplicationStatus" AS ENUM ('PENDING', 'APPROVING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ENDED');

-- CreateEnum
CREATE TYPE "AfkSessionStatus" AS ENUM ('GRANTING', 'ACTIVE', 'ENDING', 'ENDED', 'FAILED');

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

-- AddForeignKey
ALTER TABLE "afk_applications" ADD CONSTRAINT "afk_applications_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afk_applications" ADD CONSTRAINT "afk_applications_reviewed_by_discord_id_fkey" FOREIGN KEY ("reviewed_by_discord_id") REFERENCES "users"("discord_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afk_sessions" ADD CONSTRAINT "afk_sessions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "afk_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afk_sessions" ADD CONSTRAINT "afk_sessions_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "discord_identities"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Enforce duplicate protection even across multiple site processes.
CREATE UNIQUE INDEX afk_one_open_application ON afk_applications(discord_user_id,family) WHERE status IN ('PENDING','APPROVING','APPROVED');
CREATE UNIQUE INDEX afk_one_live_session ON afk_sessions(discord_user_id,family) WHERE status IN ('GRANTING','ACTIVE','ENDING');
ALTER TABLE afk_applications ADD CONSTRAINT afk_duration_valid CHECK (requested_end_at > requested_start_at AND requested_end_at <= requested_start_at + INTERVAL '24 hours');
ALTER TABLE afk_applications ADD CONSTRAINT afk_reason_valid CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000);
ALTER TABLE afk_applications ADD CONSTRAINT afk_rejection_valid CHECK (status <> 'REJECTED' OR (rejection_reason IS NOT NULL AND char_length(btrim(rejection_reason)) BETWEEN 1 AND 1000));
