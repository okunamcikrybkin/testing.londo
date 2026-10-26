-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('PENDING', 'APPROVING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PromotionQuestionType" AS ENUM ('SHORT', 'PARAGRAPH');

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

-- AddForeignKey
ALTER TABLE "promotion_criteria" ADD CONSTRAINT "promotion_criteria_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "promotion_ranks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_questions" ADD CONSTRAINT "promotion_questions_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "promotion_ranks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "promotion_ranks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "discord_identities"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One active request per participant, family and rank, including in-flight Discord work.
CREATE UNIQUE INDEX "promotion_applications_pending_unique" ON "promotion_applications" ("discordUserId", "family", "rankId") WHERE "status" IN ('PENDING', 'APPROVING');
