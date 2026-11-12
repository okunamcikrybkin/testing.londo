import type {Guild} from "discord.js";
export async function applicationMembership(guild:Guild,discordId:string):Promise<{status:"MEMBER"|"NOT_MEMBER"|"UNAVAILABLE"}>{
 if(!/^\d{17,20}$/.test(process.env.DISCORD_GUILD_ID?.trim()??"")||guild.id!==process.env.DISCORD_GUILD_ID?.trim())return {status:"UNAVAILABLE"};
 try{await guild.members.fetch({user:discordId,force:true});return {status:"MEMBER"};}catch(e){return {status:e&&typeof e==="object"&&"code" in e&&e.code===10007?"NOT_MEMBER":"UNAVAILABLE"};}
}

export async function applicationMemberRoles(guild:Guild,discordId:string){
 if(!/^\d{17,20}$/.test(process.env.DISCORD_GUILD_ID?.trim()??"")||guild.id!==process.env.DISCORD_GUILD_ID?.trim())return {status:"UNAVAILABLE"};
 try{const member=await guild.members.fetch({user:discordId,force:true});const roleNames=Object.fromEntries([...member.roles.cache.values()].filter(role=>role.id!==guild.id&&typeof role.name==="string").map(role=>[role.id,role.name]));return {status:"MEMBER",roles:[...member.roles.cache.keys()].filter(id=>id!==guild.id),...(Object.keys(roleNames).length?{roleNames}:{})};}
 catch(e){const error=e as {code?:unknown;status?:unknown};return {status:error?.code===10007?"NOT_MEMBER":"UNAVAILABLE",...(typeof error?.code==="number"?{code:error.code}:{}),...(typeof error?.status==="number"?{httpStatus:error.status}:{})};}
}
