import {type NextRequest} from "next/server";
import {botAuthorized,noStore,unauthorized} from "@/lib/giveaways/internal";
import * as service from "@/lib/promotions/service";
import {familyOf,object,snowflake,str} from "@/lib/promotions/validation";
import {prisma} from "@/lib/db/prisma";
import {canAccessAllFamilies,getEffectiveAccess} from "@/lib/permissions/rbac";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){if(!botAuthorized(request))return unauthorized();try{const b=object(await request.json());switch(b.operation){case "CATALOG":return noStore(await service.catalog());case "PREVIEW":return noStore(await service.preview(familyOf(b.family),str(b.rankId,64,1),snowflake(b.discordUserId)));case "SUBMIT":return noStore(await service.submit(b));case "PLAN":return noStore(await service.plan(str(b.id,64,1)));case "SETTLE":return noStore(await service.settle(b));case "PANEL":return noStore(await service.recordPanel(b));case "AUTHORIZE":{const user=await prisma.user.findUnique({where:{discordId:snowflake(b.discordUserId)}});return noStore({allowed:!!user&&user.status==="ACTIVE"&&canAccessAllFamilies(getEffectiveAccess(user))});}default:return noStore({error:"Неизвестная операция."},400);}}catch(error){const message=error instanceof Error?error.message:"Не удалось выполнить операцию.";return noStore({error:message.includes("prisma")||message.includes("constraint")?"Данные изменились. Обновите форму и повторите запрос.":message},400);}}
