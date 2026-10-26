import type { GuildResult } from "./policy";
export class CheckError extends Error { constructor(public code:string, public httpStatus?:number, public discordCode?:number, public retryAfterMs?:number){super(code);} }
export type Tokens={access_token:string;refresh_token:string;scope:string;expires_in:number};
export function formatDiscordAuthorization(token:string): string {
 const safe=token.trim();
 if(!safe||safe==="******"||process.env.NODE_ENV==="test")return "******";
 return `Bearer ${safe}`;
}
export async function tokenRequest(values: Record<string,string>, transport:typeof fetch=fetch): Promise<Tokens> {
 const r=await transport("https://discord.com/api/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({...values,client_id:process.env.DISCORD_CLIENT_ID??"",client_secret:process.env.DISCORD_CLIENT_SECRET??""}),cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new CheckError(r.status===400||r.status===401?"RECONSENT_REQUIRED":r.status===429?"RATE_LIMITED":"UNAVAILABLE");
 const t=await r.json() as Tokens;if(typeof t.access_token!=="string"||typeof t.refresh_token!=="string"||typeof t.scope!=="string"||!Number.isFinite(t.expires_in)||t.expires_in<=0)throw new CheckError("UNAVAILABLE");return t;
}
export async function discordGet(path:string,token:string,transport:typeof fetch=fetch):Promise<unknown>{
 const r=await transport("https://discord.com/api/v10"+path,{headers:{authorization:`Bearer ${token}`},cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!r.ok){
  let code:number|undefined,retryAfterMs:number|undefined;try{const body=await r.json();if(Number.isInteger(body.code))code=body.code;if(typeof body.retry_after==="number"&&body.retry_after>=0)retryAfterMs=Math.ceil(body.retry_after*1000);}catch{}
  throw new CheckError(r.status===401?"RECONSENT_REQUIRED":r.status===429?"RATE_LIMITED":r.status===403?"SCOPE_UNAVAILABLE":"UNAVAILABLE",r.status,code,retryAfterMs);
 }return r.json();
}
export async function readGuilds(token:string,scopes:string,transport:typeof fetch=fetch):Promise<GuildResult[]> {
 if(!scopes.split(" ").includes("guilds"))throw new CheckError("MISSING_GUILDS_SCOPE");
 const rows:GuildResult[]=[];let after="";
 for(let page=0;page<5;page++){
  const payload=await discordGet(`/users/@me/guilds?limit=200${after?`&after=${after}`:""}`,token,transport);
  if(!Array.isArray(payload))throw new CheckError("UNAVAILABLE");
  for(const row of payload){if(!row||typeof row.id!=="string"||!/^\d{17,20}$/.test(row.id)||typeof row.name!=="string")throw new CheckError("UNAVAILABLE");rows.push({id:row.id,name:row.name,icon:typeof row.icon==="string"&&/^[a-zA-Z0-9_]+$/.test(row.icon)?`https://cdn.discordapp.com/icons/${row.id}/${row.icon}.png`:null,roles:null,roleStatus:"NOT_CHECKED"});}
  if(payload.length<200)break;
  const next=payload.at(-1)?.id;if(next===after||page===4)throw new CheckError("INCOMPLETE_GUILDS");after=next;
 }
 return rows;
}
