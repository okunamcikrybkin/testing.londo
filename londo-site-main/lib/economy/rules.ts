import {canUseFeature} from "../permissions/features";
import { Prisma } from "@prisma/client";
export type EconomyActor = { id: string; discordId: string; displayName: string; effectiveAccess: string; status: string };
export class EconomyError extends Error { constructor(public code:string,message:string,public status=400){super(message);} }
export function canManageEconomy(user: Pick<EconomyActor,"effectiveAccess"|"status"> | null) { return user?.status === "ACTIVE" && canUseFeature(user.effectiveAccess,"economy"); }
export function requireFullAccess(user: EconomyActor | null): asserts user is EconomyActor {
  if(!canManageEconomy(user))throw new EconomyError("FORBIDDEN","Управлять экономикой может только администрация сайта.",403);
}
export function parseOperation(value:unknown) {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new EconomyError("INVALID_INPUT","Некорректный запрос.");
  const b=value as Record<string,unknown>;
  if(Object.keys(b).some(k=>!["targetDiscordId","amount","reason","requestId"].includes(k)))throw new EconomyError("INVALID_INPUT","Неизвестные поля запроса.");
  if(typeof b.targetDiscordId!=="string"||!/^\d{17,20}$/.test(b.targetDiscordId))throw new EconomyError("INVALID_TARGET","Выберите пользователя.");
  const amount=typeof b.amount==="number"||typeof b.amount==="string"?String(b.amount):"";
  if(!/^\d{1,7}(\.\d{1,4})?$/.test(amount)||new Prisma.Decimal(amount).lte(0)||new Prisma.Decimal(amount).gt(1000000))throw new EconomyError("INVALID_AMOUNT","Количество: больше 0 и не больше 1 000 000, до четырёх знаков после точки.");
  if(typeof b.reason!=="string"||!b.reason.trim()||b.reason.trim().length>500)throw new EconomyError("INVALID_REASON","Укажите причину: от 1 до 500 символов.");
  if(typeof b.requestId!=="string"||!/^[a-zA-Z0-9_-]{16,80}$/.test(b.requestId))throw new EconomyError("INVALID_REQUEST_ID","Некорректный идентификатор операции.");
  return{targetDiscordId:b.targetDiscordId,amount:new Prisma.Decimal(amount),reason:b.reason.trim(),requestId:b.requestId};
}
export type ManualMetadata={targetDiscordId:string;targetName:string;amount:string;reason:string;actorDiscordId:string;actorName:string;transactionId:string;operation:"GRANT"|"DEBIT"};
export function parseHistory(params:URLSearchParams) {
  const target=params.get("target")||"",operation=params.get("operation")||"",date=params.get("date")||"",page=Number(params.get("page")||1);
  if(target&&!/^\d{17,20}$/.test(target))throw new EconomyError("INVALID_TARGET","Некорректный Discord ID.");
  if(operation&&!['GRANT','DEBIT'].includes(operation))throw new EconomyError("INVALID_INPUT","Некорректный тип операции.");
  if(!Number.isInteger(page)||page<1||page>10000)throw new EconomyError("INVALID_INPUT","Некорректная страница.");
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new EconomyError("INVALID_INPUT","Некорректная дата.");
  return{target,operation,date,page};
}
