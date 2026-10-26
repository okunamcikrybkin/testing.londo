-- CreateEnum
CREATE TYPE "RoulettePrizeType" AS ENUM ('COINS', 'DISCORD_ROLE', 'MANUAL', 'NOTHING');

-- CreateEnum
CREATE TYPE "RouletteSpinType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "RouletteSpinStatus" AS ENUM ('COMPLETED', 'PENDING_FULFILLMENT', 'PENDING_DELIVERY', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EconomyTransactionReason" ADD VALUE 'ROULETTE_SPIN';
ALTER TYPE "EconomyTransactionReason" ADD VALUE 'ROULETTE_REWARD';

-- AlterEnum
ALTER TYPE "EconomyTransactionSource" ADD VALUE 'ROULETTE';

-- CreateTable
CREATE TABLE "roulette_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paidSpinPrice" DECIMAL(20,4) NOT NULL DEFAULT 25,
    "freeSpinCooldownHours" INTEGER NOT NULL DEFAULT 24,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roulette_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roulette_prizes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "RoulettePrizeType" NOT NULL,
    "weight" INTEGER NOT NULL,
    "coinAmount" DECIMAL(20,4),
    "discordRoleId" TEXT,
    "manualText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roulette_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roulette_spins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "spinType" "RouletteSpinType" NOT NULL,
    "pricePaid" DECIMAL(20,4) NOT NULL,
    "status" "RouletteSpinStatus" NOT NULL,
    "requestId" TEXT NOT NULL,
    "prizeName" TEXT NOT NULL,
    "prizeType" "RoulettePrizeType" NOT NULL,
    "coinAmount" DECIMAL(20,4),
    "discordRoleId" TEXT,
    "manualText" TEXT,
    "wheelSnapshot" JSONB NOT NULL,
    "deliveryNote" TEXT,
    "fulfilledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "roulette_spins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roulette_prizes_isActive_sortOrder_idx" ON "roulette_prizes"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "roulette_spins_userId_spinType_createdAt_idx" ON "roulette_spins"("userId", "spinType", "createdAt");

-- CreateIndex
CREATE INDEX "roulette_spins_status_createdAt_idx" ON "roulette_spins"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "roulette_spins_userId_requestId_key" ON "roulette_spins"("userId", "requestId");

-- AddForeignKey
ALTER TABLE "roulette_spins" ADD CONSTRAINT "roulette_spins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_spins" ADD CONSTRAINT "roulette_spins_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "voice_profiles"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_spins" ADD CONSTRAINT "roulette_spins_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "roulette_prizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Singleton configuration; prizes are intentionally configured by the owner.
ALTER TABLE "roulette_settings" ADD CONSTRAINT "roulette_settings_singleton" CHECK (id = 'global');
ALTER TABLE "roulette_settings" ADD CONSTRAINT "roulette_settings_limits" CHECK ("paidSpinPrice" >= 0 AND "freeSpinCooldownHours" BETWEEN 1 AND 8760);
ALTER TABLE "roulette_prizes" ADD CONSTRAINT "roulette_prize_weight" CHECK (weight BETWEEN 1 AND 1000000);
ALTER TABLE "roulette_prizes" ADD CONSTRAINT "roulette_prize_payload" CHECK (
  (type = 'COINS' AND "coinAmount" IS NOT NULL AND "coinAmount" > 0) OR
  (type = 'DISCORD_ROLE' AND "discordRoleId" IS NOT NULL) OR
  (type = 'MANUAL' AND "manualText" IS NOT NULL) OR type = 'NOTHING'
);
INSERT INTO "roulette_settings" (id, "isEnabled", "paidSpinPrice", "freeSpinCooldownHours", "updatedAt") VALUES ('global', true, 25, 24, CURRENT_TIMESTAMP);
