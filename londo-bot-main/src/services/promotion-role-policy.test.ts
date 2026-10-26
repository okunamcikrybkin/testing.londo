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
 const config={staffRoleIds:{MEMPHIS:["1545123264643473524"],PHOENIX:["1545123264643473523"]}} as ApplicationConfig;
 return {roles,fetches:()=>fetches,manager:new PromotionsManager(guild,{siteUrl:"http://invalid",apiSecret:"test"},{fam:"fam",memphis:"memphis",phoenix:"phoenix"},config)};
}
test("promotion IDs match the existing canonical Discord mapping without changing roster priorities",()=>{for(const family of ["MEMPHIS","PHOENIX"] as const)for(const role of promotionRoleAllowlist(family))assert.ok(FAMILY_RANKS.some(r=>r.roleId===role.roleId&&r.scopes.includes(family)));assert.equal(FAMILY_RANKS.find(r=>r.key==="MAIN")?.priority,6);});
test("bot options exposes only ordered family allowlist and keeps Discord safety filtering",async()=>{const f=fixture();for(const family of ["MEMPHIS","PHOENIX"] as const)assert.deepEqual((await f.manager.options(family)).roles.map(r=>r.id),promotionRoleAllowlist(family).map(r=>r.roleId));f.roles.get("1545123264626430072")!.managed=true;assert.equal((await f.manager.options("MEMPHIS")).roles.some(r=>r.id==="1545123264626430072"),false);assert.deepEqual((await f.manager.options()).roles,[]);});
test("bot internal check rejects forged IDs and wrong-family Recruit before any Discord call",async()=>{const f=fixture();for(const id of ["800000000000000001","1545123264643473523","1545123264626430071"]){await assert.rejects(f.manager.check("800000000000000099",id,"MEMPHIS"),/недоступна/);}assert.equal(f.fetches(),0);assert.equal((await f.manager.check("800000000000000099","1545123264643473524","MEMPHIS")).owned,false);assert.equal((await f.manager.check("800000000000000099","1545123264626430072","MEMPHIS")).owned,false);});
