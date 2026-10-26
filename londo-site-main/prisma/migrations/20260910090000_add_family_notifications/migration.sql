-- CreateTable
CREATE TABLE "family_notification_settings" (
    "family" "Family" NOT NULL,
    "channelId" TEXT,
    "applicationPingRoleId" TEXT,
    "promotionPingRoleId" TEXT,
    "vacationPingRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_notification_settings_pkey" PRIMARY KEY ("family")
);

-- CreateTable
CREATE TABLE "application_notification_receipts" (
    "eventId" TEXT NOT NULL,
    "family" "Family" NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_notification_receipts_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_notification_settings_channelId_key" ON "family_notification_settings"("channelId");

