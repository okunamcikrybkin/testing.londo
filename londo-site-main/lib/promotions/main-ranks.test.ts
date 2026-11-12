import test from "node:test";
import assert from "node:assert/strict";
import { mainRankCleanup, MAIN_RANK_ROLE_IDS } from "./main-ranks";
import { promotionRoleAllowlist } from "./role-allowlist";
import { FAMILY_RANKS } from "../rank-appearance/catalog";
for(const family of ["MEMPHIS"] as const){
 test(family+": main cleanup includes configured Newbie and rank roles",()=>{
  for(const {roleId:target} of promotionRoleAllowlist(family)){
   const ids=mainRankCleanup(family,target,false);
   assert.equal(ids.length,MAIN_RANK_ROLE_IDS.length-1);
   assert.ok(ids.includes(FAMILY_RANKS.find(rank=>rank.key==="NEWBIE")!.roleId));
   assert.ok(!ids.includes(target));
   assert.deepEqual(new Set([...ids,target]),new Set(MAIN_RANK_ROLE_IDS));
   assert.deepEqual(mainRankCleanup(family,target,true),[]);
  }
 });
}
test("wrong-family target cannot trigger cleanup; configured positions are preserved",()=>{
 assert.deepEqual(mainRankCleanup("PHOENIX",process.env.MEMPHIS_RECRUIT_ROLE_ID!,false),[]);
 assert.deepEqual(mainRankCleanup("MEMPHIS",process.env.PHOENIX_RECRUIT_ROLE_ID!,false),[]);
 assert.deepEqual(mainRankCleanup("MEMPHIS","staff",false),[]);
 const position=FAMILY_RANKS.find(rank=>rank.key==="BABY_LONDO")!.roleId;
 assert.ok(!mainRankCleanup("MEMPHIS",process.env.MAIN_ROLE_ID!,false,[position]).includes(position));
});
