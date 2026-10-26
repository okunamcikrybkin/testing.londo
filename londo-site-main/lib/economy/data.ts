import { prisma } from "../db/prisma";
import { EconomyError, parseHistory, requireFullAccess, type EconomyActor } from "./rules";
export async function searchUsers(actor:EconomyActor|null,q:string) {
  requireFullAccess(actor);q=q.trim();if(q.length<2||q.length>100)throw new EconomyError("INVALID_QUERY","Введите от 2 до 100 символов.");
  const match={contains:q,mode:"insensitive" as const};
  const [identities,users]=await Promise.all([prisma.discordIdentity.findMany({where:{OR:[{discordUserId:match},{username:match},{displayName:match},{gameNickname:match},{staticId:match}]},take:25,orderBy:{displayName:"asc"}}),prisma.user.findMany({where:{OR:[{discordId:match},{username:match},{displayName:match}]},take:25,orderBy:{displayName:"asc"},select:{discordId:true,displayName:true,username:true}})]);
  const ids=[...new Set([...identities.map(x=>x.discordUserId),...users.map(x=>x.discordId)])].slice(0,25);
  const [details,profiles,memberships]=await Promise.all([prisma.discordIdentity.findMany({where:{discordUserId:{in:ids}}}),prisma.voiceProfile.findMany({where:{discordUserId:{in:ids}}}),prisma.familyMembership.findMany({where:{discordUserId:{in:ids},active:true},select:{discordUserId:true,family:true}})]);
  return ids.map(discordId=>{const d=details.find(x=>x.discordUserId===discordId),u=users.find(x=>x.discordId===discordId),p=profiles.find(x=>x.discordUserId===discordId);return{discordId,displayName:d?.displayName||u?.displayName||discordId,username:d?.username||u?.username||"",gameNickname:d?.gameNickname||null,staticId:d?.staticId||null,families:memberships.filter(x=>x.discordUserId===discordId).map(x=>x.family),balance:p?.balance.toString()||"0",xp:p?.xp||0};});
}
export async function manualHistory(actor:EconomyActor|null,params:URLSearchParams) {
  requireFullAccess(actor);const f=parseHistory(params);
  const where={source:"ADMIN" as const,reason:f.operation?f.operation==="GRANT"?"ADMIN_GRANT" as const:"ADMIN_DEBIT" as const:{in:["ADMIN_GRANT" as const,"ADMIN_DEBIT" as const]},...(f.target?{discordUserId:f.target}:{}),...(f.date?{createdAt:{gte:new Date(f.date),lt:new Date(+new Date(f.date)+86400000)}}:{})};
  const [transactions,total]=await Promise.all([prisma.economyTransaction.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],take:50,skip:(f.page-1)*50}),prisma.economyTransaction.count({where})]);return{transactions,total,page:f.page};
}
