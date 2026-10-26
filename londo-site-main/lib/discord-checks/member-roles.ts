import {CheckError,formatDiscordAuthorization} from "./discord-api";
import {ROLE_CACHE_MS,type GuildResult} from "./policy";
import {type RoleQueue} from "./role-queue";
export async function readMemberRoles(row:GuildResult,token:string,scopes:string,queue:RoleQueue,transport:typeof fetch=fetch):Promise<GuildResult>{
 const base:GuildResult={id:row.id,name:row.name,icon:row.icon,roles:null,roleStatus:"UNAVAILABLE",roleSource:"OAUTH",roleCheckedAt:new Date().toISOString()};
 if(!scopes.split(" ").includes("guilds.members.read"))return {...base,roleStatus:"MISSING_SCOPE"};
 try{return await queue.run<GuildResult>(row.id,async()=>{
  const response=await transport(`https://discord.com/api/v10/users/@me/guilds/${row.id}/member`,{headers:{authorization:`Bearer ${token}`},cache:"no-store",signal:AbortSignal.timeout(10000)});
  const body=await response.json().catch(()=>null);queue.observe(response,body);
  const code=Number.isInteger(body?.code)?body.code:undefined;
  const result:GuildResult={...base,roleHttpStatus:response.status,...(code!==undefined?{roleErrorCode:code}:{})};
  if(response.ok&&Array.isArray(body?.roles)&&body.roles.every((id:unknown)=>typeof id==="string"&&/^\d{17,20}$/.test(id)))return {...result,roles:body.roles,roleStatus:"AVAILABLE",roleCheckedAt:new Date().toISOString()};
  console.info("[Discord member check]",JSON.stringify({guildId:row.id,httpStatus:response.status,discordCode:code??null,hasMembers:true}));
  if(response.status===429){const retry=Math.max(Number(response.headers.get("Retry-After"))||0,Number(body?.retry_after)||0,Number(response.headers.get("X-RateLimit-Reset-After"))||0,1);return {...result,roleStatus:"RATE_LIMITED",roleRetryAt:new Date(Date.now()+retry*1000).toISOString()};}
  return {...result,roleStatus:response.status===401?"RECONSENT_REQUIRED":response.ok||response.status===404?"UNAVAILABLE":"API_ERROR"};
 },ROLE_CACHE_MS,result=>result.roleStatus==="AVAILABLE");}catch(e){return {...base,roleStatus:e instanceof CheckError&&e.code==="RATE_LIMITED"?"RATE_LIMITED":"UNAVAILABLE",...(e instanceof CheckError&&e.retryAfterMs?{roleRetryAt:new Date(Date.now()+e.retryAfterMs).toISOString()}:{})};}
}
