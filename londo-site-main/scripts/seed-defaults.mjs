import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe('ALTER TABLE "family_notification_settings" ADD COLUMN IF NOT EXISTS "vacationMaxHours" INTEGER NOT NULL DEFAULT 168');
  await prisma.$executeRawUnsafe('ALTER TABLE "profile_customizations" ADD COLUMN IF NOT EXISTS "customStaticId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "profile_customizations" ADD COLUMN IF NOT EXISTS "characters" JSONB NOT NULL DEFAULT \'[]\'::jsonb');
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
