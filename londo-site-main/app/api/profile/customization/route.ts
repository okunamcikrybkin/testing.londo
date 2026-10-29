import {type NextRequest} from "next/server";
import {getCurrentUser} from "@/lib/auth/session";
import {noStore,unauthorized} from "@/lib/giveaways/internal";
import {readCustomization,saveCustomization} from "@/lib/profile-customization/service";
export const dynamic="force-dynamic";
export async function GET(){const user=await getCurrentUser();if(!user)return unauthorized();return noStore(await readCustomization(user.id));}
export async function PUT(request:NextRequest){const user=await getCurrentUser();if(!user)return unauthorized();try{const origin=request.headers.get("origin");if(request.headers.get("sec-fetch-site")==="cross-site"||(origin&&new URL(origin).host!==request.headers.get("host")))return noStore({error:"Запрос отклонён."},403);const body=await request.json();const reset=body?.action==="reset";if(reset&&Object.keys(body).length!==1)throw Error("Сброс изменяет только ваш профиль.");return noStore({settings:await saveCustomization(user.id,body,reset)});}catch(e){const message=e instanceof Error?e.message:"Не удалось сохранить профиль.";console.error(`[profile/customization] save failed for user ${user.id}:`,e);return noStore({error:/prisma|constraint|invocation/i.test(message)?"Не удалось сохранить профиль.":message},400);}}
