import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../auth/session";
import { EconomyError, requireFullAccess, type EconomyActor } from "./rules";
export async function economyApi(request:NextRequest,action:(actor:EconomyActor)=>Promise<unknown>) {
  try{const actor=await getCurrentUser();requireFullAccess(actor);
    if(request.method!=="GET"){const origin=request.headers.get("origin");if(request.headers.get("sec-fetch-site")==="cross-site"||(origin&&new URL(origin).host!==request.headers.get("host")))throw new EconomyError("FORBIDDEN","Запрос отклонён.",403);if(!request.headers.get("content-type")?.includes("application/json"))throw new EconomyError("INVALID_INPUT","Ожидается JSON.");}
    return NextResponse.json(await action(actor),{headers:{"Cache-Control":"no-store"}});
  }catch(e){return NextResponse.json({error:e instanceof EconomyError?e.message:"Не удалось подтвердить операцию. Повторите запрос с тем же идентификатором.",code:e instanceof EconomyError?e.code:"UNAVAILABLE"},{status:e instanceof EconomyError?e.status:503,headers:{"Cache-Control":"no-store"}});}
}
