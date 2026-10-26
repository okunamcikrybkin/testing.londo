-- CreateTable
CREATE TABLE "profile_customizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'DEFAULT',
    "accentColor" TEXT NOT NULL DEFAULT 'THEME',
    "bannerPreset" TEXT NOT NULL DEFAULT 'DEFAULT',
    "customBannerUrl" TEXT,
    "avatarFrame" TEXT NOT NULL DEFAULT 'NONE',
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

-- CreateIndex
CREATE UNIQUE INDEX "profile_customizations_userId_key" ON "profile_customizations"("userId");

-- AddForeignKey
ALTER TABLE "profile_customizations" ADD CONSTRAINT "profile_customizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

