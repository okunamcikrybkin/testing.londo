import "server-only";
import {cache} from "react";
import {prisma} from "@/lib/db/prisma";
import {canManageRankColors,defaultRankColors,getRankColor,validateRankColors,type RankColors} from "./rules";
export const getRankColors=cache(async():Promise<RankColors>=>{
 const rows=await prisma.rankAppearance.findMany({select:{roleId:true,color:true}});
 const colors=defaultRankColors();for(const row of rows)if(row.roleId in colors)colors[row.roleId]=getRankColor(row.roleId,{[row.roleId]:row.color});return colors;
});
export async function saveRankColors(actor:{id:string;effectiveAccess:string;status:string},body:unknown){
 if(!canManageRankColors(actor))throw Error("Настраивать цвета рангов может только администрация.");
 const colors=validateRankColors(body);
 return prisma.$transaction(async tx=>{
  // Serializes this settings page's writes so audit previousColor is accurate.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(71930428)`;
  const prior=await tx.rankAppearance.findMany({select:{roleId:true,color:true}}),old=Object.fromEntries(prior.map(r=>[r.roleId,r.color]));
  const changedRanks=Object.entries(colors).filter(([id,color])=>getRankColor(id,old)!==color).map(([roleId,newColor])=>({roleId,previousColor:getRankColor(roleId,old),newColor}));
  for(const change of changedRanks)await tx.rankAppearance.upsert({where:{roleId:change.roleId},create:{roleId:change.roleId,color:change.newColor},update:{color:change.newColor}});
  if(changedRanks.length)await tx.auditLog.create({data:{actorId:actor.id,action:"RANK_COLORS_UPDATED",targetType:"RankAppearance",metadata:{actorUserId:actor.id,changedRanks}}});
  return colors;
 });
}
