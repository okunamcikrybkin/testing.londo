import {type NextRequest} from "next/server";
import {botAuthorized,noStore,unauthorized} from "@/lib/giveaways/internal";
import {claimReceipt,queue,receipt,resolutionReceipt} from "@/lib/notifications/service";
import {claimApplicationFromDiscord} from "@/lib/applications/claim";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){if(!botAuthorized(request))return unauthorized();try{const b=await request.json();if(b.operation==="QUEUE")return noStore(await queue());if(b.operation==="RECEIPT")return noStore(await receipt(b));if(b.operation==="RESOLUTION_RECEIPT")return noStore(await resolutionReceipt(b));if(b.operation==="CLAIM_RECEIPT")return noStore(await claimReceipt(b));if(b.operation==="CLAIM")return noStore(await claimApplicationFromDiscord(String(b.eventId),String(b.discordId)));return noStore({error:"Неизвестная операция."},400);}catch(error){return noStore({error:error instanceof Error?error.message:"Уведомления временно недоступны."},400);}}
