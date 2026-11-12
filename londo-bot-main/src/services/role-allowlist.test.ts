import test from "node:test";
import assert from "node:assert/strict";
import {FAMILY_RANKS} from "../config/familyRanks.js";
import {assertPromotionRoleAllowed,filterPromotionRoles,isPromotionRoleAllowed,promotionRoleAllowlist} from "./role-allowlist.js";

const memphis=promotionRoleAllowlist("MEMPHIS").map(role=>role.roleId);
const phoenix=promotionRoleAllowlist("PHOENIX").map(role=>role.roleId);
test("promotion role allowlist uses configured IDs and 2/3/4/5/6/8 order for each family",()=>{
 for(const [family,ids] of [["MEMPHIS",memphis],["PHOENIX",phoenix]] as const){assert.deepEqual(promotionRoleAllowlist(family).map(r=>r.roleId),ids);assert.deepEqual(promotionRoleAllowlist(family).map(r=>r.order),[2,3,4,5,6,8]);for(const id of ids)assert.doesNotThrow(()=>assertPromotionRoleAllowed(family,id));}
});
test("arbitrary IDs, other-family Recruit, Newbie and senior roles are denied",()=>{
 const denied=[FAMILY_RANKS.find(rank=>rank.key==="NEWBIE")!.roleId,...FAMILY_RANKS.filter(rank=>rank.priority>=7&&rank.key!=="MEMPHIS_RECRUIT").map(rank=>rank.roleId),"800000000000000001","Main",null];
 for(const family of ["MEMPHIS","PHOENIX"]){for(const id of [...denied,...(family==="MEMPHIS"?[process.env.PHOENIX_RECRUIT_ROLE_ID!]:[process.env.MEMPHIS_RECRUIT_ROLE_ID!])]){assert.equal(isPromotionRoleAllowed(family,id),false);assert.throws(()=>assertPromotionRoleAllowed(family,id));}}
 assert.throws(()=>assertPromotionRoleAllowed("MEMPHIS",phoenix[3]));assert.throws(()=>assertPromotionRoleAllowed("PHOENIX",memphis[3]));for(const family of [undefined,"all","memphis",""])assert.deepEqual(promotionRoleAllowlist(family),[]);
});
test("picker ignores spoofed names and Discord hierarchy order, preserves safe subset",()=>{
 const roles=[...memphis,phoenix[3],"forged"].reverse().map((id,position)=>({id,name:id==="forged"?"Main":"Renamed role",position}));assert.deepEqual(filterPromotionRoles(roles,"MEMPHIS").map(r=>r.id),memphis);assert.deepEqual(filterPromotionRoles(roles,"PHOENIX").map(r=>r.id),phoenix);assert.equal(filterPromotionRoles(roles,"MEMPHIS")[0].name,"Renamed role");assert.deepEqual(filterPromotionRoles(roles.filter(r=>r.id!==memphis[0]),"MEMPHIS").map(r=>r.id),memphis.slice(1));
});
