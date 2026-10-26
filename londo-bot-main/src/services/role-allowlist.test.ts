import test from "node:test";
import assert from "node:assert/strict";
import {assertPromotionRoleAllowed,filterPromotionRoles,isPromotionRoleAllowed,promotionRoleAllowlist} from "./role-allowlist.js";

const memphis=["1545123264626430072","1545123264626430073","1545123264643473519","1545123264643473524","1545123264643473520","1545123264643473521"];
const phoenix=[...memphis];phoenix[3]="1545123264643473523";
test("promotion role allowlist uses exact IDs and 2/3/4/5/6/8 order for each family",()=>{
 for(const [family,ids] of [["MEMPHIS",memphis],["PHOENIX",phoenix]] as const){assert.deepEqual(promotionRoleAllowlist(family).map(r=>r.roleId),ids);assert.deepEqual(promotionRoleAllowlist(family).map(r=>r.order),[2,3,4,5,6,8]);for(const id of ids)assert.doesNotThrow(()=>assertPromotionRoleAllowed(family,id));}
});
test("arbitrary IDs, other-family Recruit, Newbie and senior roles are denied",()=>{
 for(const family of ["MEMPHIS","PHOENIX"]){for(const id of ["1545123264626430071","1545123264668369040","1545453391537242232","1545123264655794265","1545123264655794264","1545123264655794263","1545123264643473528","1545123264643473527","1545123264643473526","1545123264643473525","800000000000000001","Main",null]){assert.equal(isPromotionRoleAllowed(family,id),false);assert.throws(()=>assertPromotionRoleAllowed(family,id));}}
 assert.throws(()=>assertPromotionRoleAllowed("MEMPHIS",phoenix[3]));assert.throws(()=>assertPromotionRoleAllowed("PHOENIX",memphis[3]));for(const family of [undefined,"all","memphis",""])assert.deepEqual(promotionRoleAllowlist(family),[]);
});
test("picker ignores spoofed names and Discord hierarchy order, preserves safe subset",()=>{
 const roles=[...memphis,phoenix[3],"forged"].reverse().map((id,position)=>({id,name:id==="forged"?"Main":"Renamed role",position}));assert.deepEqual(filterPromotionRoles(roles,"MEMPHIS").map(r=>r.id),memphis);assert.deepEqual(filterPromotionRoles(roles,"PHOENIX").map(r=>r.id),phoenix);assert.equal(filterPromotionRoles(roles,"MEMPHIS")[0].name,"Renamed role");assert.deepEqual(filterPromotionRoles(roles.filter(r=>r.id!==memphis[0]),"MEMPHIS").map(r=>r.id),memphis.slice(1));
});
