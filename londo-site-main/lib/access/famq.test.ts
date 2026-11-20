import assert from "node:assert/strict";
import test from "node:test";
import {FAMQ_RANK_IDS,membershipRoleIds,resolveFamqFamilies} from "./famq";
import {sessionStaffState} from "./session-policy";
import {canUseFeature,FEATURE_ACCESS,navigationForAccess,featureForPage} from "../permissions/features";
import {canReviewAccessRequest,hasPermission,PERMISSIONS} from "../permissions/rbac";
const roles=membershipRoleIds();
for(const rank of FAMQ_RANK_IDS)test(`FAM + MEMPHIS + rank ${rank} resolves FAMQ`,()=>assert.deepEqual(resolveFamqFamilies([roles.fam,roles.memphis,rank],roles),["MEMPHIS"]));
test("family scopes require FAM, membership and an ordinary rank together",()=>{
 const rank=FAMQ_RANK_IDS[0];
 assert.deepEqual(resolveFamqFamilies([roles.fam,roles.memphis,rank],roles),["MEMPHIS"]);
 for(const ids of [[roles.memphis,rank],[roles.fam,rank],[roles.fam,roles.memphis],[roles.fam,"legacy-family-rank",rank],[],null])assert.deepEqual(resolveFamqFamilies(ids,roles),[]);
});
test("PIN gating and staff revocation preserve independent base membership",()=>{
 const user={role:"RECRUIT" as const,accessSnapshot:{roleIds:[roles.fam,roles.memphis,FAMQ_RANK_IDS[0]]},staffAccessGrants:[{role:"RECRUIT" as const,memphisRole:"RECRUIT" as const,phoenixRole:"USER" as const}],staffAccessCredential:{pinSetAt:new Date(),credentialVersion:1}};
 const session={user,staffPinVerifiedAt:null,staffPinCredentialVersion:null};
 const locked=sessionStaffState(session,false);
 assert.deepEqual(locked.famqFamilies,["MEMPHIS"]);assert.equal(locked.role,"USER");assert.equal(locked.pinRequired,true);
 assert.equal(locked.baseFamilyAccess.MEMPHIS,"FAMQ");assert.equal(locked.baseFamilyAccess.PHOENIX,"USER");
 const verified=sessionStaffState({...session,staffPinVerifiedAt:new Date(),staffPinCredentialVersion:1},false);assert.equal(verified.role,"RECRUIT");assert.equal(verified.pinRequired,false);
 const curatorSession={...session,user:{...user,role:"CURATOR" as const,staffAccessGrants:[{role:"HIGH_STAFF" as const,memphisRole:"HIGH_STAFF" as const,phoenixRole:"USER" as const}]}};
 const curator=sessionStaffState({...curatorSession,staffPinVerifiedAt:new Date(),staffPinCredentialVersion:1},false);
 assert.equal(curator.role,"CURATOR");assert.equal(curator.approvedRole,"CURATOR");assert.deepEqual(curator.familyAccess,{MEMPHIS:"CURATOR",PHOENIX:"USER"});
 const revoked=sessionStaffState({...session,user:{...user,role:"USER",staffAccessGrants:[]}},false);assert.deepEqual(revoked.famqFamilies,["MEMPHIS"]);assert.equal(revoked.pinRequired,false);
 const removed=sessionStaffState({...session,user:{...user,accessSnapshot:{roleIds:[roles.memphis,FAMQ_RANK_IDS[0]]},staffAccessGrants:[]}},false);assert.deepEqual(removed.famqFamilies,[]);
});
test("complete access matrix agrees with explicit feature grants",()=>{
 const levels=["USER","FAMQ","RECRUIT","CURATOR","HIGH_STAFF","DEP_OWNER","OWNER","FULL_ACCESS"] as const;
 for(const access of levels){for(const [feature,allowed] of Object.entries(FEATURE_ACCESS))assert.equal(canUseFeature(access,feature as keyof typeof FEATURE_ACCESS),allowed.some(level=>level===access));
 for(const item of navigationForAccess(access))assert.equal(canUseFeature(access,item.feature),true);}
 assert.equal(canUseFeature("USER","roulette"),false);assert.equal(canUseFeature("FAMQ","roulette"),true);
 assert.equal(canUseFeature("FAMQ","dashboard"),false);assert.equal(canUseFeature("RECRUIT","dashboard"),true);
 assert.equal(canUseFeature("CURATOR","dashboard"),true);assert.equal(canUseFeature("CURATOR","recruitStatistics"),true);assert.equal(canUseFeature("CURATOR","logs"),false);
 assert.equal(canUseFeature("HIGH_STAFF","roulette"),true);assert.equal(canUseFeature("HIGH_STAFF","dashboard"),false);assert.equal(canUseFeature("HIGH_STAFF","giveaways"),false);
 assert.equal(canUseFeature("DEP_OWNER","dashboard"),true);assert.equal(canUseFeature("DEP_OWNER","logs"),true);assert.equal(canUseFeature("DEP_OWNER","discordLogs"),true);assert.equal(canUseFeature("DEP_OWNER","recruitStatistics"),true);assert.equal(canUseFeature("DEP_OWNER","shopManage"),false);
 for(const permission of PERMISSIONS)assert.equal(hasPermission("HIGH_STAFF",permission),hasPermission("FAMQ",permission));
 for(const feature of Object.keys(FEATURE_ACCESS) as (keyof typeof FEATURE_ACCESS)[])assert.equal(canUseFeature("HIGH_STAFF",feature),canUseFeature("FAMQ",feature));
 assert.equal(hasPermission("CURATOR","recruit.statistics"),true);assert.equal(hasPermission("DEP_OWNER","logs.view"),true);
 assert.equal(canReviewAccessRequest("OWNER","DEP_OWNER"),true);assert.equal(canReviewAccessRequest("DEP_OWNER","RECRUIT"),false);
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
