import assert from "node:assert/strict";
import test from "node:test";
import {DEFAULT_MEMBERSHIP_ROLES as roles,FAMQ_RANK_IDS,resolveFamqFamilies} from "./famq";
import {sessionStaffState} from "./session-policy";
import {canUseFeature,FEATURE_ACCESS,navigationForAccess,featureForPage} from "../permissions/features";
for(const rank of FAMQ_RANK_IDS)test(`FAM + MEMPHIS + rank ${rank} resolves FAMQ`,()=>assert.deepEqual(resolveFamqFamilies([roles.fam,roles.memphis,rank],roles),["MEMPHIS"]));
test("family scopes require FAM, membership and an ordinary rank together",()=>{
 const rank=FAMQ_RANK_IDS[0];
 assert.deepEqual(resolveFamqFamilies([roles.fam,roles.phoenix,rank],roles),["PHOENIX"]);
 assert.deepEqual(resolveFamqFamilies([roles.fam,roles.memphis,roles.phoenix,rank],roles),["MEMPHIS","PHOENIX"]);
 for(const ids of [[roles.memphis,rank],[roles.phoenix,rank],[roles.fam,rank],[roles.fam,roles.memphis],[roles.fam,roles.phoenix,"1545123264643473523"],[],null])assert.deepEqual(resolveFamqFamilies(ids,roles),[]);
});
test("PIN gating and staff revocation preserve independent base membership",()=>{
 const user={role:"RECRUIT" as const,accessSnapshot:{roleIds:[roles.fam,roles.phoenix,FAMQ_RANK_IDS[0]]},staffAccessGrants:[{role:"RECRUIT" as const,memphisRole:"USER" as const,phoenixRole:"RECRUIT" as const}],staffAccessCredential:{pinSetAt:new Date(),credentialVersion:1}};
 const session={user,staffPinVerifiedAt:null,staffPinCredentialVersion:null};
 const locked=sessionStaffState(session,false);
 assert.deepEqual(locked.famqFamilies,["PHOENIX"]);assert.equal(locked.role,"USER");assert.equal(locked.pinRequired,true);
 assert.equal(locked.baseFamilyAccess.MEMPHIS,"USER");assert.equal(locked.baseFamilyAccess.PHOENIX,"FAMQ");
 const verified=sessionStaffState({...session,staffPinVerifiedAt:new Date(),staffPinCredentialVersion:1},false);assert.equal(verified.role,"RECRUIT");assert.equal(verified.pinRequired,false);
 const revoked=sessionStaffState({...session,user:{...user,role:"USER",staffAccessGrants:[]}},false);assert.deepEqual(revoked.famqFamilies,["PHOENIX"]);assert.equal(revoked.pinRequired,false);
 const removed=sessionStaffState({...session,user:{...user,accessSnapshot:{roleIds:[roles.phoenix,FAMQ_RANK_IDS[0]]},staffAccessGrants:[]}},false);assert.deepEqual(removed.famqFamilies,[]);
});
test("complete six-level matrix agrees with navigation",()=>{
 const levels=["USER","FAMQ","RECRUIT","HIGH_STAFF","OWNER","FULL_ACCESS"] as const;
 for(const access of levels){for(const [feature,minimum] of Object.entries(FEATURE_ACCESS))assert.equal(canUseFeature(access,feature as keyof typeof FEATURE_ACCESS),levels.indexOf(access)>=levels.indexOf(minimum));
 for(const item of navigationForAccess(access))assert.equal(canUseFeature(access,item.feature),true);}
 assert.equal(canUseFeature("USER","roulette"),false);assert.equal(canUseFeature("FAMQ","roulette"),true);
 assert.equal(canUseFeature("FAMQ","dashboard"),false);assert.equal(canUseFeature("RECRUIT","dashboard"),true);
 assert.equal(canUseFeature("OWNER","economy"),false);assert.equal(canUseFeature("OWNER","rankColors"),true);
 assert.equal(canUseFeature("garbage","profile"),false);
 assert.equal(featureForPage("/roulette/admin/prizes/new"),"rouletteAdmin");assert.equal(featureForPage("/access/manage?tab=active"),"accessManagement");
 assert.deepEqual(navigationForAccess("USER").map(n=>n.feature),["aboutLondo","ownAccess"]);
});

test("PIN gate covers staff pages but never FAMQ roulette or personal access",async()=>{
 const {isStaffPage}=await import("./policy");
 for(const path of ["/dashboard","/giveaways","/shop","/logs","/access/manage","/notification-settings","/faction-roles","/settings/rank-colors","/economy","/roulette/admin"])assert.equal(isStaffPage(path),true,path);
 for(const path of ["/roulette","/profile","/settings/interface","/about","/access","/access/pin/verify"])assert.equal(isStaffPage(path),false,path);
});
