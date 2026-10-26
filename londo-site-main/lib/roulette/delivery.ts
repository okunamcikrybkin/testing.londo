import { prisma } from "../db/prisma";
import { shopBot } from "../shop/bot";
// Role grants are idempotent. A missing acknowledgement leaves the original entitlement pending.
export async function deliverRole(id: string, db = prisma, deliver = (body: object) => shopBot<{ code: string }>("/internal/discord/roulette/deliver", body)) {
  const spin = await db.rouletteSpin.findUniqueOrThrow({ where: { id } });
  if (spin.status !== "PENDING_DELIVERY" || spin.prizeType !== "DISCORD_ROLE") return spin;
  try {
    const result = await deliver({ spinId: spin.id, discordUserId: spin.discordUserId, roleId: spin.discordRoleId });
    if (result.code === "GRANTED" || result.code === "ALREADY_OWNED") await db.rouletteSpin.updateMany({ where: { id, status: "PENDING_DELIVERY" }, data: { status: "COMPLETED", fulfilledAt: new Date(), deliveryNote: result.code === "ALREADY_OWNED" ? "Эта роль уже была у вас." : "Роль выдана в Discord." } });
  } catch { /* Preserve the prize and allow an explicit retry from the admin history. */ }
  return db.rouletteSpin.findUniqueOrThrow({ where: { id } });
}
