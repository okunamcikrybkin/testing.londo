import test from "node:test";
import assert from "node:assert/strict";
import { applyRolePlan, PromotionsManager, type PromotionRank } from "./promotions.js";
import { mainRankCleanup, MAIN_RANK_ROLE_IDS } from "./main-ranks.js";
import { FAMILY_RANKS } from "../config/familyRanks.js";
import { Collection, type Guild } from "discord.js";
import type { ApplicationConfig } from "../types/family.js";
const role=(key:string)=>FAMILY_RANKS.find(r=>r.key===key)!.roleId;
const steps=[["NEWBIE","BABY_LONDO"],["NEWBIE","LONDO"],["BABY_LONDO","YOUNG_LONDO"],["YOUNG_LONDO","LONDO"],["LONDO","MEMPHIS_RECRUIT"],["MEMPHIS_RECRUIT","LONDEST_LONDO"],["LONDEST_LONDO","MAIN"],["LONDO","PHOENIX_RECRUIT"]];
function fixture(keys:string[],target:string,family:"MEMPHIS"|"PHOENIX"="MEMPHIS"){
 const held=new Set(keys),events:string[]=[];
 const ops={has:async(id:string)=>held.has(id),add:async(id:string)=>{events.push("add:"+id);held.add(id);},remove:async(id:string)=>{events.push("remove:"+id);held.delete(id);}};
 const plan={discordUserId:"user",family,targetRoleId:target,removeRoleIds:[]};
 return {held,events,ops,plan,cleanup:mainRankCleanup(family,target,false)};
}
for(const [from,to] of steps)test(from+" -> "+to,async()=>{
 const f=fixture([role(from)],role(to),to==="PHOENIX_RECRUIT"?"PHOENIX":"MEMPHIS");
 assert.equal(await applyRolePlan(f.plan,f.ops,f.cleanup),"APPLIED");
 assert.deepEqual([...f.held],[role(to)]);assert.equal(f.events[0],"add:"+role(to));
});
test("all old ranks removed, unrelated roles preserved, repeat does not duplicate operations",async()=>{
 const other=[role("OWNER"),role("MEMPHIS_HIGH_STAFF"),"fam","memphis","phoenix","vacation","afk","media","decorative","integration"];
 const target=role("MAIN"),f=fixture([...MAIN_RANK_ROLE_IDS,...other],target);
 assert.equal(await applyRolePlan(f.plan,f.ops,f.cleanup),"APPLIED");
 assert.deepEqual(new Set(f.held),new Set([target,...other]));
 assert.ok(!f.events.some(e=>e.startsWith("add:")));const count=f.events.length;
 assert.equal(await applyRolePlan(f.plan,f.ops,f.cleanup),"APPLIED");assert.equal(f.events.length,count);
});
test("position approval leaves main ranks intact",async()=>{
 const f=fixture([role("NEWBIE")],role("MAIN"));
 assert.equal(await applyRolePlan(f.plan,f.ops,mainRankCleanup("MEMPHIS",role("MAIN"),true)),"APPLIED");
 assert.ok(f.held.has(role("NEWBIE")));assert.ok(f.held.has(role("MAIN")));
});
test("failed or unconfirmed grant never removes old ranks",async()=>{
 for(const throws of [true,false]){
  const f=fixture([role("NEWBIE")],role("LONDO"));f.ops.add=async()=>{if(throws)throw Error("grant failed");};
  assert.equal(await applyRolePlan(f.plan,f.ops,f.cleanup),"RETRY");
  assert.deepEqual([...f.held],[role("NEWBIE")]);assert.equal(f.events.length,0);
 }
});
test("failed removal retains confirmed target and retries cleanup without duplicate grant",async()=>{
 const f=fixture([role("NEWBIE"),role("BABY_LONDO")],role("LONDO")),remove=f.ops.remove;
 f.ops.remove=async id=>{if(id===role("BABY_LONDO"))throw Error("Missing Permissions");await remove(id);};
 assert.equal(await applyRolePlan(f.plan,f.ops,f.cleanup),"RETRY");assert.ok(f.held.has(role("LONDO")));
 f.ops.remove=remove;assert.equal(await applyRolePlan(f.plan,f.ops,f.cleanup),"APPLIED");
 assert.deepEqual([...f.held],[role("LONDO")]);assert.equal(f.events.filter(e=>e.startsWith("add:")).length,1);
});
test("roles acquired during grant are also cleaned",async()=>{
 const f=fixture([role("NEWBIE")],role("LONDO")),add=f.ops.add;
 f.ops.add=async id=>{await add(id);f.held.add(role("PHOENIX_RECRUIT"));};
 assert.equal(await applyRolePlan(f.plan,f.ops,f.cleanup),"APPLIED");assert.deepEqual([...f.held],[role("LONDO")]);
});
test("manager repairs legacy empty plan, ignores removePreviousRank and preserves configured positions",async()=>{
 const target=role("LONDO"),position=role("BABY_LONDO"),held=new Collection<string,unknown>([[role("NEWBIE"),{}],[role("MEMPHIS_RECRUIT"),{}],[position,{}],["fam",{}],["memphis",{}]]);
 const user={id:"800000000000000099",username:"Test",displayAvatarURL:()=>"https://example.invalid/a"};
 const member={id:user.id,user,displayName:"Test",nickname:null,joinedAt:new Date(),displayAvatarURL:user.displayAvatarURL,roles:{cache:held,add:async(id:string)=>{held.set(id,{});},remove:async(id:string)=>{held.delete(id);}}};
 const guild={id:"guild",members:{fetch:async()=>member},roles:{fetch:async(id:string)=>({id,managed:false,editable:true,tags:null})}} as unknown as Guild;
 const ranks=[{id:"r",family:"MEMPHIS",discordRoleId:target,isActive:true,isPosition:false,removePreviousRank:false},{id:"p",family:"MEMPHIS",discordRoleId:position,isActive:true,isPosition:true}] as unknown as PromotionRank[];
 const settlements:Record<string,unknown>[]=[];
 class Manager extends PromotionsManager{
  override async request<T>(body:object):Promise<T>{const b=body as Record<string,unknown>;if(b.operation==="PLAN")return {plan:{discordUserId:user.id,family:"MEMPHIS",targetRoleId:target,removeRoleIds:[]}} as T;if(b.operation==="CATALOG")return {ranks,settings:[],queue:[]} as T;if(b.operation==="SETTLE"){settlements.push(b);return {} as T;}throw Error("unexpected");}
  override async check(){return {removableRoleIds:[],roleIds:[...held.keys()],families:["MEMPHIS" as const],owned:held.has(target),username:"Test",displayName:"Test"};}
 }
 const manager=new Manager(guild,{siteUrl:"https://example.invalid",apiSecret:"test"},{fam:"fam",memphis:"memphis",phoenix:"phoenix"},{staffRoleIds:{MEMPHIS:[],PHOENIX:[]}} as unknown as ApplicationConfig);
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response("{}");
 try{assert.equal((await manager.apply("app")).outcome,"APPLIED");assert.deepEqual(new Set(held.keys()),new Set([target,position,"fam","memphis"]));assert.deepEqual(new Set(settlements[0].removedRoleIds as string[]),new Set([role("NEWBIE"),role("MEMPHIS_RECRUIT")]));assert.equal((await manager.apply("app")).outcome,"APPLIED");assert.deepEqual(settlements[1].removedRoleIds,[]);}finally{globalThis.fetch=original;}
});
