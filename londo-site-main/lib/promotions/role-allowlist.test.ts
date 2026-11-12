import test from "node:test";
import assert from "node:assert/strict";
import {FAMILY_RANKS} from "../rank-appearance/catalog";
import {assertPromotionRoleAllowed,filterPromotionRoles,isPromotionRoleAllowed,promotionRoleAllowlist} from "./role-allowlist";

const memphis=promotionRoleAllowlist("MEMPHIS").map(role=>role.roleId);
const unavailableRole=process.env.PHOENIX_RECRUIT_ROLE_ID!;
test("promotion role allowlist uses configured IDs and the established order",()=>{
 assert.deepEqual(promotionRoleAllowlist("MEMPHIS").map(r=>r.roleId),memphis);assert.deepEqual(promotionRoleAllowlist("MEMPHIS").map(r=>r.order),[2,3,4,5,6,8]);for(const id of memphis)assert.doesNotThrow(()=>assertPromotionRoleAllowed("MEMPHIS",id));
});
test("arbitrary IDs, other-family Recruit, Newbie and senior roles are denied",()=>{
 const denied=[FAMILY_RANKS.find(rank=>rank.key==="NEWBIE")!.roleId,FAMILY_RANKS.find(rank=>rank.key==="OWNER")!.roleId,...FAMILY_RANKS.filter(rank=>rank.priority>=7&&rank.key!=="MEMPHIS_RECRUIT").map(rank=>rank.roleId),"800000000000000001","Main",null,unavailableRole];
 for(const id of denied){assert.equal(isPromotionRoleAllowed("MEMPHIS",id),false);assert.throws(()=>assertPromotionRoleAllowed("MEMPHIS",id));}
 for(const family of ["PHOENIX",undefined,"all","memphis",""])assert.deepEqual(promotionRoleAllowlist(family),[]);
});
test("picker ignores spoofed names and Discord hierarchy order, preserves safe subset",()=>{
 const roles=[...memphis,unavailableRole,"forged"].reverse().map((id,position)=>({id,name:id==="forged"?"Main":"Renamed role",position}));assert.deepEqual(filterPromotionRoles(roles,"MEMPHIS").map(r=>r.id),memphis);assert.deepEqual(filterPromotionRoles(roles,"PHOENIX"),[]);assert.equal(filterPromotionRoles(roles,"MEMPHIS")[0].name,"Renamed role");assert.deepEqual(filterPromotionRoles(roles.filter(r=>r.id!==memphis[0]),"MEMPHIS").map(r=>r.id),memphis.slice(1));
});
