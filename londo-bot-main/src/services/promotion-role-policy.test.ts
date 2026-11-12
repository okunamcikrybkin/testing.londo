import test from "node:test";
import assert from "node:assert/strict";
import {Collection,type Guild} from "discord.js";
import {PromotionsManager} from "./promotions.js";
import {promotionRoleAllowlist} from "./role-allowlist.js";
import {FAMILY_RANKS} from "../config/familyRanks.js";
import type {ApplicationConfig} from "../types/family.js";

function fixture(){
 const ids=[...new Set([...promotionRoleAllowlist("MEMPHIS"),...promotionRoleAllowlist("PHOENIX")].map(r=>r.roleId))];
 const roles=new Collection(ids.concat(["800000000000000001"]).reverse().map((id,index)=>[id,{id,name:id==="800000000000000001"?"Main":"Discord name "+index,position:index,managed:false,editable:true,tags:null,comparePositionTo:()=>-1}]));
 let fetches=0;const member={roles:{cache:new Collection([["fam",{}],["memphis",{}]])},user:{username:"user"},displayName:"User"};
 const guild={id:"guild",roles:{cache:roles,fetch:async(id?:string)=>{fetches++;return id?roles.get(id):roles;}},channels:{cache:new Collection(),fetch:async()=>undefined},members:{fetch:async()=>{fetches++;return member;},fetchMe:async()=>({permissions:{has:()=>true},roles:{highest:{}}})}} as unknown as Guild;
 const config={staffRoleIds:{MEMPHIS:[process.env.MEMPHIS_RECRUIT_ROLE_ID!],PHOENIX:[process.env.PHOENIX_RECRUIT_ROLE_ID!]}} as ApplicationConfig;
 return {roles,fetches:()=>fetches,manager:new PromotionsManager(guild,{siteUrl:"http://invalid",apiSecret:"test"},{fam:"fam",memphis:"memphis",phoenix:"phoenix"},config)};
}
test("configured promotion IDs preserve the Memphis roster mapping and priorities",()=>{for(const role of promotionRoleAllowlist("MEMPHIS"))assert.ok(FAMILY_RANKS.some(r=>r.roleId===role.roleId&&r.scopes.includes("MEMPHIS")));assert.equal(promotionRoleAllowlist("PHOENIX")[3]?.roleId,process.env.PHOENIX_RECRUIT_ROLE_ID);assert.equal(FAMILY_RANKS.find(r=>r.key==="MAIN")?.priority,6);});
test("bot options exposes only ordered family allowlist and keeps Discord safety filtering",async()=>{const f=fixture();for(const family of ["MEMPHIS","PHOENIX"] as const)assert.deepEqual((await f.manager.options(family)).roles.map(r=>r.id),promotionRoleAllowlist(family).map(r=>r.roleId));const baby=process.env.BABY_LONDO_ROLE_ID!;f.roles.get(baby)!.managed=true;assert.equal((await f.manager.options("MEMPHIS")).roles.some(r=>r.id===baby),false);assert.deepEqual((await f.manager.options()).roles,[]);});
test("bot internal check rejects forged IDs and wrong-family Recruit before any Discord call",async()=>{const f=fixture();for(const id of ["800000000000000001",process.env.PHOENIX_RECRUIT_ROLE_ID!,process.env.NEWBIE_ROLE_ID!]){await assert.rejects(f.manager.check("800000000000000099",id,"MEMPHIS"),/недоступна/);}assert.equal(f.fetches(),0);assert.equal((await f.manager.check("800000000000000099",process.env.MEMPHIS_RECRUIT_ROLE_ID!,"MEMPHIS")).owned,false);assert.equal((await f.manager.check("800000000000000099",process.env.BABY_LONDO_ROLE_ID!,"MEMPHIS")).owned,false);});
