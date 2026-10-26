import test from "node:test";
import assert from "node:assert/strict";
import { mainRankCleanup, MAIN_RANK_ROLE_IDS } from "./main-ranks.js";
import { promotionRoleAllowlist } from "./role-allowlist.js";
for(const family of ["MEMPHIS","PHOENIX"] as const){
 test(family+": main cleanup includes Newbie and both Recruit roles, independent of configured ranks",()=>{
  for(const {roleId:target} of promotionRoleAllowlist(family)){
   const ids=mainRankCleanup(family,target,false);
   assert.equal(ids.length,7);
   assert.ok(ids.includes("1545123264626430071"));
   assert.ok(!ids.includes(target));
   assert.deepEqual(new Set([...ids,target]),new Set(MAIN_RANK_ROLE_IDS));
   assert.deepEqual(mainRankCleanup(family,target,true),[]);
  }
 });
}
test("wrong-family target cannot trigger cleanup; configured positions are preserved",()=>{
 assert.deepEqual(mainRankCleanup("PHOENIX","1545123264643473524",false),[]);
 assert.deepEqual(mainRankCleanup("MEMPHIS","1545123264643473523",false),[]);
 assert.deepEqual(mainRankCleanup("MEMPHIS","staff",false),[]);
 assert.ok(!mainRankCleanup("MEMPHIS","1545123264643473519",false,["1545123264626430072"]).includes("1545123264626430072"));
});
