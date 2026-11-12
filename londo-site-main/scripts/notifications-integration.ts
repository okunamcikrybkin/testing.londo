import assert from "node:assert/strict";
import {loadEnvConfig} from "@next/env";
loadEnvConfig(process.cwd(),true,{info(){},error(){}});
async function main(){const {prisma}=await import("../lib/db/prisma"),{queue,receipt}=await import("../lib/notifications/service");const rollback=new Error("QA_ROLLBACK");let checked=0;
try{await prisma.$transaction(async tx=>{
 const n=String(Date.now()),userId="80000"+n;
 await tx.discordIdentity.create({data:{discordUserId:userId,username:"notification-qa",displayName:"QA"}});
 const channelId="81111"+n;await tx.familyNotificationSettings.upsert({where:{family:"MEMPHIS"},create:{family:"MEMPHIS",channelId},update:{channelId}});
 const rank=await tx.promotionRank.create({data:{family:"MEMPHIS",name:"Notification QA",discordRoleId:"83333"+n}});
 const join=await tx.familyApplication.create({data:{family:"MEMPHIS",discordUserId:userId,discordUsername:"QA",discordDisplayName:"QA",answers:{}}});
 const promotion=await tx.promotionApplication.create({data:{family:"MEMPHIS",discordUserId:userId,rankId:rank.id,rankName:"QA",requestKey:"MEMPHIS"+n,identitySnapshot:{},criteriaSnapshot:[],answers:[],currentDiscordRoleIds:[]}});
 const vacation=await tx.afkApplication.create({data:{family:"MEMPHIS",discordUserId:userId,reason:"QA",requestKey:"vacation"+n,requestedStartAt:new Date(),requestedEndAt:new Date(Date.now()+60000)}});
 const eventIds:string[]=[];
 for(const [action,id] of [["APPLICATION_CREATED",join.id],["PROMOTION_APPLICATION_CREATED",promotion.id],["AFK_APPLICATION_CREATED",vacation.id]]){const event=await tx.auditLog.create({data:{action,targetId:id,metadata:{family:"MEMPHIS"}}});eventIds.push(event.id);}
 const items=(await queue(tx)).filter(i=>eventIds.includes(i.eventId));assert.equal(items.length,3);
 for(const item of items){assert.equal(item.family,"MEMPHIS");assert.equal(item.channelId,channelId);assert.ok(item.path.includes("memphis"));checked++;}
 const first=items[0];await assert.rejects(receipt({...first,family:"PHOENIX",messageId:"85555"+n},tx));checked++;
 await receipt({...first,messageId:"85555"+n},tx);assert.ok(!(await queue(tx)).some(i=>i.eventId===first.eventId));checked++;
 await tx.familyNotificationSettings.update({where:{family:"MEMPHIS"},data:{channelId:null}});assert.ok(!(await queue(tx)).some(i=>i.family==="MEMPHIS"));checked++;
 throw rollback;
},{timeout:30000});}catch(e){if(e!==rollback)throw e;}finally{await prisma.$disconnect();}
console.log(`Notifications dev DB integration: ${checked} PASS; all test data rolled back`);}
main().catch(e=>{console.error(e instanceof Error?e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,"[REDACTED]"):"Integration failed");process.exitCode=1;});
