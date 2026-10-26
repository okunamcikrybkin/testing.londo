import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
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
