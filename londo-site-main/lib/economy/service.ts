import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { EconomyError, parseOperation, requireFullAccess, type EconomyActor, type ManualMetadata } from "./rules";
export async function adjustCoins(actor:EconomyActor|null,operation:"GRANT"|"DEBIT",body:unknown,db=prisma) {
  requireFullAccess(actor);const input=parseOperation(body);
  const sourceId=`economy-admin:${actor.id}:${input.requestId}`;
  return db.$transaction(async tx=>{
    const [identity,user]=await Promise.all([tx.discordIdentity.findUnique({where:{discordUserId:input.targetDiscordId}}),tx.user.findUnique({where:{discordId:input.targetDiscordId}})]);
    if(!identity&&!user)throw new EconomyError("TARGET_NOT_FOUND","Пользователь не найден в базе LONDO.",404);
    await tx.$executeRaw(Prisma.sql`INSERT INTO voice_profiles (discord_user_id,updated_at) VALUES (${input.targetDiscordId},NOW()) ON CONFLICT (discord_user_id) DO NOTHING`);
    await tx.$queryRaw(Prisma.sql`SELECT discord_user_id FROM voice_profiles WHERE discord_user_id=${input.targetDiscordId} FOR UPDATE`);
    const previous=await tx.economyTransaction.findUnique({where:{sourceId}});
    if(previous){const m=previous.metadata as unknown as ManualMetadata;if(m.operation!==operation||m.targetDiscordId!==input.targetDiscordId||!previous.amount.equals(input.amount)||m.reason!==input.reason)throw new EconomyError("IDEMPOTENCY_CONFLICT","Этот запрос уже использован для другой операции.",409);return{transaction:previous,balance:(await tx.voiceProfile.findUniqueOrThrow({where:{discordUserId:input.targetDiscordId}})).balance};}
    const max=new Prisma.Decimal("9999999999999999.9999");
    const changed=await tx.voiceProfile.updateMany({where:{discordUserId:input.targetDiscordId,balance:operation==="DEBIT"?{gte:input.amount}:{lte:max.minus(input.amount)}},data:{balance:operation==="DEBIT"?{decrement:input.amount}:{increment:input.amount}}});
    if(changed.count!==1)throw new EconomyError(operation==="DEBIT"?"INSUFFICIENT_BALANCE":"BALANCE_LIMIT",operation==="DEBIT"?"Нельзя снять больше текущего баланса.":"Достигнут предел баланса.",409);
    const id=randomUUID();const metadata:ManualMetadata={targetDiscordId:input.targetDiscordId,targetName:identity?.displayName||user!.displayName,amount:input.amount.toString(),reason:input.reason,actorDiscordId:actor.discordId,actorName:actor.displayName,transactionId:id,operation};
    const transaction=await tx.economyTransaction.create({data:{id,discordUserId:input.targetDiscordId,amount:input.amount,type:operation==="GRANT"?"CREDIT":"DEBIT",reason:operation==="GRANT"?"ADMIN_GRANT":"ADMIN_DEBIT",source:"ADMIN",sourceId,metadata}});
    await tx.auditLog.create({data:{actorId:actor.id,action:operation==="GRANT"?"ECONOMY_ADMIN_GRANT":"ECONOMY_ADMIN_DEBIT",targetType:"EconomyTransaction",targetId:id,metadata}});
    return{transaction,balance:(await tx.voiceProfile.findUniqueOrThrow({where:{discordUserId:input.targetDiscordId}})).balance};
  },{timeout:15000,maxWait:10000});
}
