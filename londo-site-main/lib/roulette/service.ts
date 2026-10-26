import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { selectPrize } from "./random";
import { cooldownEnd, requireAdmin, requirePlayer, RouletteError, spinInput, type Actor } from "./rules";

export async function spin(user: Actor | null, body: unknown, db = prisma, now = () => new Date()) {
  requirePlayer(user);
  const input = spinInput(body);
  return db.$transaction(async tx => {
    // Upsert also covers the first spin of a player who has never earned voice coins.
    await tx.$executeRaw(Prisma.sql`INSERT INTO voice_profiles (discord_user_id, updated_at) VALUES (${user.discordId}, NOW()) ON CONFLICT (discord_user_id) DO NOTHING`);
    await tx.$queryRaw(Prisma.sql`SELECT discord_user_id FROM voice_profiles WHERE discord_user_id = ${user.discordId} FOR UPDATE`);
    const previous = await tx.rouletteSpin.findUnique({ where: { userId_requestId: { userId: user.id, requestId: input.requestId } } });
    if (previous) return previous;
    // Admin catalog writes take this same row exclusively, preserving one catalog per draw.
    await tx.$queryRaw`SELECT id FROM roulette_settings WHERE id = 'global' FOR SHARE`;
    const settings = await tx.rouletteSettings.findUniqueOrThrow({ where: { id: "global" } });
    if (!settings.isEnabled) throw new RouletteError("DISABLED", "Рулетка временно выключена.", 409);
    const createdAt = now();
    if (input.spinType === "FREE") {
      const last = await tx.rouletteSpin.findFirst({ where: { userId: user.id, spinType: "FREE" }, orderBy: { createdAt: "desc" } });
      const next = cooldownEnd(last?.createdAt ?? null, settings.freeSpinCooldownHours);
      if (next && +createdAt < +next) throw new RouletteError("COOLDOWN", "Бесплатное вращение ещё не доступно.", 409);
    }
    const prizes = await tx.roulettePrize.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
    const prize = selectPrize(prizes);
    const price = input.spinType === "PAID" ? settings.paidSpinPrice : new Prisma.Decimal(0);
    if (input.spinType === "PAID") {
      const debit = await tx.voiceProfile.updateMany({ where: { discordUserId: user.discordId, balance: { gte: price } }, data: { balance: { decrement: price } } });
      if (debit.count !== 1) throw new RouletteError("INSUFFICIENT_COINS", "Недостаточно монет.", 409);
    }
    const id = randomUUID();
    const metadata = { rouletteSpinId: id, roulettePrizeId: prize.id, spinType: input.spinType };
    if (input.spinType === "PAID") await tx.economyTransaction.create({ data: { discordUserId: user.discordId, amount: price, type: "DEBIT", reason: "ROULETTE_SPIN", source: "ROULETTE", sourceId: "roulette-debit:" + id, metadata } });
    if (prize.type === "COINS") {
      if (!prize.coinAmount || prize.coinAmount.lte(0)) throw Error("INVALID_COIN_PRIZE");
      await tx.voiceProfile.update({ where: { discordUserId: user.discordId }, data: { balance: { increment: prize.coinAmount } } });
      await tx.economyTransaction.create({ data: { discordUserId: user.discordId, amount: prize.coinAmount, type: "CREDIT", reason: "ROULETTE_REWARD", source: "ROULETTE", sourceId: "roulette-reward:" + id, metadata } });
    }
    const status = prize.type === "DISCORD_ROLE" ? "PENDING_DELIVERY" : prize.type === "MANUAL" ? "PENDING_FULFILLMENT" : "COMPLETED";
    return tx.rouletteSpin.create({ data: {
      id, userId: user.id, discordUserId: user.discordId, prizeId: prize.id, ...input, pricePaid: price, status, createdAt,
      prizeName: prize.name, prizeType: prize.type, coinAmount: prize.coinAmount, discordRoleId: prize.discordRoleId, manualText: prize.manualText,
      wheelSnapshot: prizes.map(p => ({ id: p.id, name: p.name, type: p.type })), fulfilledAt: status === "COMPLETED" ? createdAt : null,
    } });
  }, { timeout: 15000, maxWait: 10000 });
}

export async function completeManual(user: Actor | null, id: string, db = prisma) {
  requireAdmin(user);
  return db.$transaction(async tx => {
    const result = await tx.rouletteSpin.updateMany({ where: { id, prizeType: "MANUAL", status: "PENDING_FULFILLMENT" }, data: { status: "COMPLETED", fulfilledAt: new Date(), fulfilledById: user.id } });
    if (result.count) await tx.auditLog.create({ data: { actorId: user.id, action: "ROULETTE_MANUAL_FULFILLED", targetType: "RouletteSpin", targetId: id } });
    return tx.rouletteSpin.findUniqueOrThrow({ where: { id } });
  });
}
