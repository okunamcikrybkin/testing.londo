import {NextResponse,type NextRequest} from "next/server";
import {getCurrentUser} from "@/lib/auth/session";
import {canManageRankColors} from "@/lib/rank-appearance/rules";
import {getRankColors,saveRankColors} from "@/lib/rank-appearance/service";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){const user=await getCurrentUser();if(!canManageRankColors(user))return json({error:"Настраивать цвета рангов может только администрация."},403);return json({colors:await getRankColors()});}
export async function PUT(req:NextRequest){const user=await getCurrentUser();if(!user||!canManageRankColors(user))return json({error:"Настраивать цвета рангов может только администрация."},403);
 const origin=req.headers.get("origin");if(req.headers.get("sec-fetch-site")==="cross-site"||(origin&&new URL(origin).host!==req.headers.get("host")))return json({error:"Запрос отклонён."},403);
 try{return json({colors:await saveRankColors(user,await req.json())});}catch(e){const message=e instanceof Error?e.message:"Не удалось сохранить.";return json({error:/prisma|constraint|invocation/i.test(message)?"Не удалось сохранить цвета.":message},400);}
}
