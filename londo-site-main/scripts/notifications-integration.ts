import assert from "node:assert/strict";
import {loadEnvConfig} from "@next/env";
loadEnvConfig(process.cwd(),true,{info(){},error(){}});
async function main(){const {prisma}=await import("../lib/db/prisma"),{queue,receipt}=await import("../lib/notifications/service");const rollback=new Error("QA_ROLLBACK");let checked=0;
try{await prisma.$transaction(async tx=>{
 const n=String(Date.now()),userId="80000"+n;
 await tx.discordIdentity.create({data:{discordUserId:userId,username:"notification-qa",displayName:"QA"}});
 const configs={MEMPHIS:"81111"+n,PHOENIX:"82222"+n};const eventIds:string[]=[];
 for(const family of ["MEMPHIS","PHOENIX"] as const){await tx.familyNotificationSettings.upsert({where:{family},create:{family,channelId:configs[family]},update:{channelId:configs[family]}});
 const rank=await tx.promotionRank.create({data:{family,name:"Notification QA",discordRoleId:(family==="MEMPHIS"?"83333":"84444")+n}});
 const join=await tx.familyApplication.create({data:{family,discordUserId:userId,discordUsername:"QA",discordDisplayName:"QA",answers:{}}});
 const promotion=await tx.promotionApplication.create({data:{family,discordUserId:userId,rankId:rank.id,rankName:"QA",requestKey:family+n,identitySnapshot:{},criteriaSnapshot:[],answers:[],currentDiscordRoleIds:[]}});
 const vacation=await tx.afkApplication.create({data:{family,discordUserId:userId,reason:"QA",requestKey:"vacation"+family+n,requestedStartAt:new Date(),requestedEndAt:new Date(Date.now()+60000)}});
 for(const [action,id] of [["APPLICATION_CREATED",join.id],["PROMOTION_APPLICATION_CREATED",promotion.id],["AFK_APPLICATION_CREATED",vacation.id]]){const event=await tx.auditLog.create({data:{action,targetId:id,metadata:{family}}});eventIds.push(event.id);}
 }
 const items=(await queue(tx)).filter(i=>eventIds.includes(i.eventId));assert.equal(items.length,6);
 for(const item of items){assert.equal(item.channelId,configs[item.family]);assert.ok(item.path.includes(item.family.toLowerCase()));checked++;}
 const first=items[0];await assert.rejects(receipt({...first,family:first.family==="MEMPHIS"?"PHOENIX":"MEMPHIS",messageId:"85555"+n},tx));checked++;
 await receipt({...first,messageId:"85555"+n},tx);assert.ok(!(await queue(tx)).some(i=>i.eventId===first.eventId));checked++;
 await tx.familyNotificationSettings.update({where:{family:"MEMPHIS"},data:{channelId:null}});assert.ok(!(await queue(tx)).some(i=>i.family==="MEMPHIS"));checked++;
 throw rollback;
},{timeout:30000});}catch(e){if(e!==rollback)throw e;}finally{await prisma.$disconnect();}
console.log(`Notifications dev DB integration: ${checked} PASS; all test data rolled back`);}
main().catch(e=>{console.error(e instanceof Error?e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,"[REDACTED]"):"Integration failed");process.exitCode=1;});
