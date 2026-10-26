import type { Family } from "@prisma/client";

export async function afkBot<T>(operation:string,body:object):Promise<T>{const base=process.env.LONDO_BOT_INTERNAL_URL,secret=process.env.LONDO_BOT_API_SECRET;if(!base||!secret)throw Error("ROLE_UNAVAILABLE");const response=await fetch(new URL("/internal/discord/afk/"+operation,base),{method:"POST",headers:{"content-type":"application/json","x-londo-bot-secret":secret},body:JSON.stringify(body),signal:AbortSignal.timeout(12000),cache:"no-store"});if(!response.ok)throw Error("BOT_UNAVAILABLE");return response.json();}
export type AfkNotification = {
  type: "APPROVED" | "REJECTED" | "ENDED" | "ENDED_EARLY";
  discordUserId: string;
  family: Family;
  requestedStartAt: string;
  requestedEndAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  reviewerId?: string | null;
  endedById?: string | null;
  reason?: string | null;
};
export async function notifyAfk(event: AfkNotification): Promise<void> {
  await afkBot("notify", event);
}
