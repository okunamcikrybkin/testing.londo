import { type NextRequest } from "next/server";
import { botAuthorized, noStore, unauthorized } from "@/lib/giveaways/internal";
import * as service from "@/lib/faction-roles/service";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){if(!botAuthorized(request))return unauthorized();try{const b=await request.json();switch(b.operation){case "CATALOG":return noStore(await service.catalog());case "CLAIM":return noStore(await service.claim(b));case "COMPLETE":return noStore(await service.complete(b));case "PANEL":return noStore(await service.recordPanel(b));default:return noStore({error:"Неизвестная операция."},400);}}catch{return noStore({error:"Настройки изменились или операция недоступна. Повторите запрос."},400);}}
