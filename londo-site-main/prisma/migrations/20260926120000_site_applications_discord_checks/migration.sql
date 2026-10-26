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
ALTER TABLE "DiscordOAuthConsent" ADD CONSTRAINT "DiscordOAuthConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordApplicationCheck" ADD CONSTRAINT "DiscordApplicationCheck_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "family_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
