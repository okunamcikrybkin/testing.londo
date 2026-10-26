import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { noStore } from "@/lib/giveaways/internal";
import { canManageFactionRoles } from "@/lib/faction-roles/validation";
import * as service from "@/lib/faction-roles/service";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){const user=await getCurrentUser();if(!user||!canManageFactionRoles(user.effectiveAccess))return noStore({error:"Недостаточно прав."},403);try{return noStore(request.nextUrl.searchParams.get("mode")==="options"?await service.options():await service.catalog());}catch{return noStore({error:"Не удалось загрузить настройки. Проверьте подключение bot."},503);}}
export async function POST(request:NextRequest){const user=await getCurrentUser();if(!user||!canManageFactionRoles(user.effectiveAccess))return noStore({error:"Недостаточно прав."},403);
 const origin=request.headers.get("origin");if(request.headers.get("sec-fetch-site")==="cross-site"||(origin&&new URL(origin).host!==request.headers.get("host")))return noStore({error:"Запрос отклонён."},403);
 try{const body=await request.json();
 if(body.operation==="save"){
  const panel=await service.save(body.value,user.id);let warning:null|string=null;
  if(panel.messageId)try{await service.publish(user.discordId);}catch{warning="Сохранено. Панель пока не обновлена; повторите обновление после проверки bot и канала.";}
  return noStore({panel:await service.catalog(),warning});
 }
 if(body.operation==="publish"||body.operation==="refresh"){await service.publish(user.discordId);return noStore({panel:await service.catalog()});}
 return noStore({error:"Неизвестная операция."},400);
 }catch(error){const message=error instanceof Error?error.message:"Ошибка";return noStore({error:/prisma|constraint|invocation/i.test(message)?"Не удалось сохранить данные. Обновите страницу.":message},400);}
}

