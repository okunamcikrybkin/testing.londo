import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const notificationChannelId = process.env.MEMPHIS_NOTIFICATION_CHANNEL_ID?.trim() || null;

if (notificationChannelId && !/^\d{17,20}$/.test(notificationChannelId)) {
  throw new Error("MEMPHIS_NOTIFICATION_CHANNEL_ID must be a Discord snowflake.");
}

try {
  await prisma.$executeRawUnsafe('ALTER TABLE "family_notification_settings" ADD COLUMN IF NOT EXISTS "vacationMaxHours" INTEGER NOT NULL DEFAULT 168');
  await prisma.$executeRawUnsafe('ALTER TABLE "profile_customizations" ADD COLUMN IF NOT EXISTS "customStaticId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "profile_customizations" ADD COLUMN IF NOT EXISTS "customGameNickname" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "profile_customizations" ADD COLUMN IF NOT EXISTS "characters" JSONB NOT NULL DEFAULT \'[]\'::jsonb');
  await prisma.$executeRawUnsafe('ALTER TABLE "profile_customizations" ADD COLUMN IF NOT EXISTS "showBirthday" BOOLEAN NOT NULL DEFAULT true');
  await prisma.$executeRawUnsafe('ALTER TABLE "profile_customizations" ADD COLUMN IF NOT EXISTS "showCharacters" BOOLEAN NOT NULL DEFAULT true');
  await prisma.$executeRawUnsafe('ALTER TABLE "profile_customizations" ALTER COLUMN "showStaticId" SET DEFAULT true');
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "_londo_startup_migrations" ("id" TEXT PRIMARY KEY)');
  await prisma.$executeRawUnsafe(`WITH applied AS (INSERT INTO "_londo_startup_migrations" ("id") VALUES ('show_static_id_public_default') ON CONFLICT ("id") DO NOTHING RETURNING "id") UPDATE "profile_customizations" SET "showStaticId" = true WHERE "showStaticId" = false AND EXISTS (SELECT 1 FROM applied)`);
  if (notificationChannelId) {
    await prisma.$executeRawUnsafe('UPDATE "family_notification_settings" SET "channelId" = $1 WHERE "family" = \'MEMPHIS\' AND "channelId" IS NULL', notificationChannelId);
  }
  await prisma.familyNotificationSettings.upsert({ where: { family: "MEMPHIS" }, create: { family: "MEMPHIS", channelId: notificationChannelId }, update: {} });
  await prisma.rouletteSettings.upsert({
    where: { id: "global" },
    create: { id: "global", isEnabled: true, paidSpinPrice: 25, freeSpinCooldownHours: 24 },
    update: {},
  });

  await prisma.roulettePrize.upsert({
    where: { id: "default-nothing" },
    create: {
      id: "default-nothing",
      name: "Попробуйте ещё раз",
      description: "Без выигрыша в этом вращении.",
      type: "NOTHING",
      weight: 1,
      isActive: true,
      sortOrder: 0,
    },
    update: { isActive: true, deletedAt: null },
  });
} finally {
  await prisma.$disconnect();
}
