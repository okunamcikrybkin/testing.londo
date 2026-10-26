import {type NextRequest} from "next/server";
import {getFeatureUser} from "@/lib/permissions/guards";
import {noStore} from "@/lib/giveaways/internal";
import * as service from "@/lib/notifications/service";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){if(!await getFeatureUser("notifications"))return noStore({error:"Недостаточно прав."},403);try{return noStore(request.nextUrl.searchParams.get("mode")==="options"?await service.options():await service.settings());}catch{return noStore({error:"Настройки уведомлений недоступны."},503);}}
export async function POST(request:NextRequest){const user=await getFeatureUser("notifications");if(!user)return noStore({error:"Недостаточно прав."},403);const origin=request.headers.get("origin");if(request.headers.get("sec-fetch-site")==="cross-site"||(origin&&new URL(origin).host!==request.headers.get("host")))return noStore({error:"Запрос отклонён."},403);try{return noStore(await service.save(await request.json(),user.id));}catch(e){const message=e instanceof Error?e.message:"Не удалось сохранить.";return noStore({error:/prisma|constraint|invocation/i.test(message)?"Канал уже занят или данные изменились. Обновите страницу.":message},400);}}

