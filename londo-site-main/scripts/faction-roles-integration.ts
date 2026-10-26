import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(),true,{info(){},error(){}});
async function main(){
 const {prisma}=await import("../lib/db/prisma");
 const service=await import("../lib/faction-roles/service");
 const original=prisma.$transaction.bind(prisma),rollback=new Error("INTENTIONAL_TEST_ROLLBACK");
 let checks=0;
 try{await original(async tx=>{
  prisma.$transaction=((fn:(tx:typeof prisma)=>Promise<unknown>)=>fn(tx as unknown as typeof prisma)) as unknown as typeof prisma.$transaction;
  await tx.factionRolePanelSettings.upsert({where:{id:"default"},create:{id:"default"},update:{}});
  await tx.factionRolePanelSettings.update({where:{id:"default"},data:{messageId:"800000000000000091",publishedChannelId:"800000000000000092"}});
  const button=await tx.factionRoleButton.create({data:{name:"QA transaction",discordRoleId:"800000000000000093",enabled:true}});
  const now=Date.now(),snow=(delta:number)=>String((BigInt(now+delta)-BigInt(1420070400000))<<BigInt(22));
  const data={interactionId:snow(0),discordUserId:"800000000000000094",buttonId:button.id,roleId:button.discordRoleId,owned:false,messageId:"800000000000000091",channelId:"800000000000000092"};
  const first=await service.claim(data);assert.equal(first.granted,true);checks++;
  assert.equal((await service.claim(data)).id,first.id);checks++;
  await service.complete({id:first.id});await service.complete({id:first.id});
  assert.equal(await tx.auditLog.count({where:{action:"FACTION_ROLE_GRANTED",targetId:first.id}}),1);checks++;
  assert.equal((await service.claim({...data,interactionId:snow(1000),owned:true})).id,first.id);checks++;
  const second=await service.claim({...data,interactionId:snow(4000),owned:true});assert.notEqual(second.id,first.id);assert.equal(second.granted,false);checks++;
  // An unfinished operation is recovered even after the debounce interval.
  assert.equal((await service.claim({...data,interactionId:snow(10000),owned:true})).id,second.id);checks++;
  await service.complete({id:second.id});assert.equal(await tx.auditLog.count({where:{action:"FACTION_ROLE_REMOVED",targetId:second.id}}),1);checks++;
  await assert.rejects(service.claim({...data,interactionId:snow(20000),roleId:"800000000000000099"}));checks++;
  await assert.rejects(service.claim({...data,interactionId:snow(20000),messageId:"800000000000000099"}));checks++;
  await tx.factionRoleButton.update({where:{id:button.id},data:{enabled:false}});
  await assert.rejects(service.claim({...data,interactionId:snow(20000)}));checks++;
  throw rollback;
 },{timeout:30000});}catch(error){if(error!==rollback)throw error;}finally{prisma.$transaction=original;await prisma.$disconnect();}
 console.log(`Faction DB checks: ${checks} PASS; all test writes rolled back`);
}
main().catch(error=>{console.error(error instanceof Error?error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,"[REDACTED]"):"DB checks failed");process.exitCode=1;});
