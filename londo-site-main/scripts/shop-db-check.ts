import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { prisma } from "../lib/db/prisma";
import { buyItem, settlePurchase } from "../lib/shop/purchase";

// All fixtures and catalog changes live inside one transaction that ALWAYS rolls back.
// Run only against the explicitly confirmed development database.
async function main() {
 loadEnvConfig(process.cwd(),true,{info(){},error(){}});
 const suffix=randomUUID();const user="shop-test-"+suffix;const rollback=new Error("ROLLBACK_SHOP_CHECK");let verified=false;
 try {
  await prisma.$transaction(async tx=>{
   await tx.familyShopSettings.upsert({where:{family:"MEMPHIS"},create:{family:"MEMPHIS"},update:{status:"OPEN"}});
   await tx.discordIdentity.create({data:{discordUserId:user,username:"shop-test",displayName:"Temporary shop test"}});
   await tx.familyMembership.create({data:{discordUserId:user,family:"MEMPHIS",active:true,lastSyncedAt:new Date()}});
   await tx.voiceProfile.create({data:{discordUserId:user,balance:100}});
   const item=await tx.shopItem.create({data:{family:"MEMPHIS",name:"Temporary shop test",price:60,type:"MANUAL"}});
   const db={$transaction:async<T>(fn:(client:typeof tx)=>Promise<T>)=>fn(tx)} as unknown as typeof prisma;
   const dependencies={db,roleCheck:async()=>({code:"OK"})};
   const purchase=await buyItem(item.id,user,suffix+"-buy",dependencies);
   assert.equal(purchase.status,"PENDING_FULFILLMENT");
   assert.equal((await tx.voiceProfile.findUniqueOrThrow({where:{discordUserId:user}})).balance.toString(),"40");
   await assert.rejects(buyItem(item.id,user,suffix+"-insufficient",dependencies),/INSUFFICIENT_BALANCE/);
   await buyItem(item.id,user,suffix+"-buy",dependencies);
   assert.equal(await tx.shopPurchase.count({where:{discordUserId:user}}),1);
   await settlePurchase(purchase.id,true,null,false,db);await settlePurchase(purchase.id,true,null,false,db);
   assert.equal((await tx.voiceProfile.findUniqueOrThrow({where:{discordUserId:user}})).balance.toString(),"100");
   assert.equal(await tx.economyTransaction.count({where:{discordUserId:user}}),2);
   const debit=await tx.economyTransaction.findUniqueOrThrow({where:{sourceId:"shop-buy:"+suffix+"-buy"}});
   assert.equal((debit.metadata as {purchaseId:string}).purchaseId,purchase.id);
   await tx.shopItem.update({where:{id:item.id},data:{isActive:false}});
   await assert.rejects(buyItem(item.id,user,suffix+"-disabled",dependencies),/ITEM_UNAVAILABLE/);
   await tx.shopItem.update({where:{id:item.id},data:{isActive:true}});
   await tx.familyShopSettings.update({where:{family:"MEMPHIS"},data:{status:"CLOSED"}});
   await assert.rejects(buyItem(item.id,user,suffix+"-closed",dependencies),/SHOP_CLOSED/);
   await tx.familyShopSettings.update({where:{family:"MEMPHIS"},data:{status:"OPEN"}});
   await tx.familyMembership.update({where:{discordUserId_family:{discordUserId:user,family:"MEMPHIS"}},data:{active:false}});
   await assert.rejects(buyItem(item.id,user,suffix+"-family",dependencies),/WRONG_FAMILY/);
   await tx.familyMembership.update({where:{discordUserId_family:{discordUserId:user,family:"MEMPHIS"}},data:{active:true}});
   const manual=await buyItem(item.id,user,suffix+"-manual",dependencies);await settlePurchase(manual.id,false,null,false,db);
   assert.equal((await tx.shopPurchase.findUniqueOrThrow({where:{id:manual.id}})).status,"COMPLETED");
   await tx.shopItem.update({where:{id:item.id},data:{price:10,type:"DISCORD_ROLE",discordRoleId:"123456789012345678"}});
   await assert.rejects(buyItem(item.id,user,suffix+"-owned",{...dependencies,roleCheck:async()=>({code:"ALREADY_OWNED"})}),/ALREADY_OWNED/);
   const role=await buyItem(item.id,user,suffix+"-role",dependencies);await settlePurchase(role.id,true,null,true,db);
   assert.equal((await tx.voiceProfile.findUniqueOrThrow({where:{discordUserId:user}})).balance.toString(),"40");
   verified=true;throw rollback;
  },{timeout:60000});
 } catch(error) {if(error!==rollback)throw error;}
 assert.ok(verified);assert.equal(await prisma.voiceProfile.count({where:{discordUserId:user}}),0);assert.equal(await prisma.discordIdentity.count({where:{discordUserId:user}}),0);
 console.log("PASS: PostgreSQL purchase, retry, insufficient balance, inactive item, closed shop, membership, metadata, manual completion, role precheck and idempotent refunds. All fixtures rolled back.");
}
main().catch((error)=>{console.error({name:error?.name,code:error?.code,metaCode:error?.meta?.code,assertion:error?.operator,actual:error?.actual,expected:error?.expected});console.error("Shop DB verification failed; transaction rolled back. No connection details printed.");process.exitCode=1;}).finally(()=>prisma.$disconnect());
