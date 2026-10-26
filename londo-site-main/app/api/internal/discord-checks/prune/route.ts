import type {NextRequest} from "next/server";
import {botAuthorized,noStore,unauthorized} from "@/lib/giveaways/internal";
import {pruneChecks} from "@/lib/discord-checks/service";
export async function POST(request:NextRequest){if(!botAuthorized(request))return unauthorized();try{await pruneChecks();return noStore({ok:true});}catch{return noStore({error:"Очистка временно недоступна."},503);}}
