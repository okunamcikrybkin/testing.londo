import { randomInt } from "node:crypto";
import { RouletteError } from "./rules";
export function selectPrize<T extends { weight: number; isActive: boolean; deletedAt?: Date | null }>(prizes: T[], random = randomInt): T {
  const active = prizes.filter(p => p.isActive && !p.deletedAt);
  const total = active.reduce((n, p) => n + p.weight, 0);
  if (!active.length) throw new RouletteError("NO_PRIZES", "Призы пока не настроены.", 409);
  if (!Number.isSafeInteger(total) || total <= 0 || total >= 2 ** 48 || active.some(p => !Number.isSafeInteger(p.weight) || p.weight <= 0)) throw Error("INVALID_WEIGHTS");
  let ticket = random(total);
  for (const prize of active) { ticket -= prize.weight; if (ticket < 0) return prize; }
  throw Error("INVALID_RANDOM");
}
