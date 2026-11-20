import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAMILY_RANKS } from "../rank-appearance/catalog";
import { resolveDiscordAccess } from "./resolver";
import { canRequestRole, getEligibleStaffRole } from "./discord-roles";
import { parseAccessObservation } from "./protocol";
const id = (key: string) => FAMILY_RANKS.find(rank => rank.key === key)!.roleId;
test("removed Memphis Leader role is not part of the site rank catalog", () => {
  assert.equal(process.env.MEMPHIS_LEADER_ROLE_ID, undefined);
  assert.equal(FAMILY_RANKS.some(rank => rank.key === "MEMPHIS_LEADER"), false);
});
const staffMapping = [
  ["OWNER", "OWNER"],
  ["MEMPHIS_HIGH_STAFF", "HIGH_STAFF"],
  ["MEMPHIS_DEP_OWNER", "DEP_OWNER"],
  ["MEMPHIS_CUR_RECRUIT", "CURATOR"],
  ["MEMPHIS_RECRUIT", "RECRUIT"],
] as const;
for (const [key, expected] of staffMapping) test(`${key} → ${expected}, configured ID and isolated scope`, () => {
  const roleId = id(key);
  assert.match(roleId, /^\d{17,20}$/);
  const resolved = resolveDiscordAccess([roleId]);
  assert.equal(resolved.role, expected);
  assert.deepEqual(resolved.familyAccess, { MEMPHIS: expected, PHOENIX: "USER" });
});
for (const key of ["MAIN", "LONDEST_LONDO", "LONDO", "YOUNG_LONDO", "BABY_LONDO", "NEWBIE"]) test(`${key} → USER`, () => {
  assert.deepEqual(resolveDiscordAccess([id(key)]), { role: "USER", familyAccess: { MEMPHIS: "USER", PHOENIX: "USER" } });
});
for (const [keys, expected] of [
  [["OWNER"], "OWNER"],
  [["MEMPHIS_HIGH_STAFF", "MEMPHIS_CUR_RECRUIT"], "HIGH_STAFF"],
  [["MEMPHIS_DEP_OWNER", "MEMPHIS_CUR_RECRUIT"], "DEP_OWNER"],
  [[], "USER"],
] as const) test(`priority ${keys.join("+") || "none"}`, () => assert.equal(resolveDiscordAccess(keys.map(id)).role, expected));
test("unknown role ignored and both family scopes retained independently", () => {
  assert.deepEqual(resolveDiscordAccess(["999999999999999999"]), { role: "USER", familyAccess: { MEMPHIS: "USER", PHOENIX: "USER" } });
  const curatorAndStaff = resolveDiscordAccess([process.env.DISCORD_HIGH_STAFF_ROLE_IDS!, id("MEMPHIS_CUR_RECRUIT")]);
  assert.equal(curatorAndStaff.role, "HIGH_STAFF");
  assert.deepEqual(curatorAndStaff.familyAccess, { MEMPHIS: "HIGH_STAFF", PHOENIX: "USER" });
  assert.deepEqual(resolveDiscordAccess([id("MEMPHIS_HIGH_STAFF"), id("MEMPHIS_CUR_RECRUIT")]).familyAccess, { MEMPHIS: "HIGH_STAFF", PHOENIX: "USER" });
});
test("configured recruiter role resolves to a requestable MEMPHIS scope", () => {
  const previous = process.env.DISCORD_RECRUIT_ROLE_IDS;
  process.env.DISCORD_RECRUIT_ROLE_IDS = process.env.MEMPHIS_RECRUIT_ROLE_ID;
  try {
    assert.deepEqual(resolveDiscordAccess([process.env.MEMPHIS_RECRUIT_ROLE_ID!]), {
      role: "RECRUIT",
      familyAccess: { MEMPHIS: "RECRUIT", PHOENIX: "USER" },
    });
    test("deputy owner Discord rank is requestable above high staff", () => {
      assert.equal(getEligibleStaffRole([id("MEMPHIS_DEP_OWNER")]), "DEP_OWNER");
      assert.equal(getEligibleStaffRole([id("MEMPHIS_HIGH_STAFF")]), "HIGH_STAFF");
      assert.equal(canRequestRole("DEP_OWNER"), true);
    });
  } finally {
    if (previous === undefined) delete process.env.DISCORD_RECRUIT_ROLE_IDS;
    else process.env.DISCORD_RECRUIT_ROLE_IDS = previous;
  }
});
test("missing/stale/future/forged observations rejected", () => {
  const valid = { discordId: "100000000000000001", roleIds: [], observedAt: new Date().toISOString(), trigger: "ROLE_UPDATE" };
  for (const bad of [null, {}, { ...valid, roleIds: undefined }, { ...valid, observedAt: new Date(Date.now() - 121_000).toISOString() }, { ...valid, observedAt: new Date(Date.now() + 60_000).toISOString() }, { ...valid, role: "OWNER" }]) assert.throws(() => parseAccessObservation(bad));
});

test("endpoint syncs curator access, restricts other grants, and protects FULL_ACCESS", async () => {
  const require = createRequire(import.meta.url), esbuild = require("esbuild"), dir = mkdtempSync(join(tmpdir(), "access-sync-test-"));
  const originalFull = process.env.FULL_ACCESS_DISCORD_IDS, originalSecret = process.env.LONDO_BOT_API_SECRET;
  process.env.FULL_ACCESS_DISCORD_IDS = "100000000000000002"; process.env.LONDO_BOT_API_SECRET = "test-secret";
  writeFileSync(join(dir, "empty.ts"), "export {};");
  writeFileSync(join(dir, "db.ts"), `
    export const state={user:{id:'u',discordId:'100000000000000001',role:'USER',accessSnapshot:null,staffAccessGrants:[]},updates:0,audits:[],invalidated:0};
    export const prisma={$transaction:async fn=>fn(prisma),$executeRaw:async()=>0,
      user:{findUnique:async({where})=>where.discordId===state.user.discordId?state.user:null,update:async({data})=>{state.updates++;Object.assign(state.user,data);}},
      userAccessSnapshot:{upsert:async({create})=>{state.user.accessSnapshot=create;}},
      staffAccessGrant:{update:async()=>{state.user.staffAccessGrants=[];},create:async({data})=>{const grant={id:'g',...data};state.user.staffAccessGrants=[grant];return grant;}},
      staffAccessCredential:{upsert:async()=>({})},
      session:{updateMany:async()=>{state.invalidated++;}},auditLog:{create:async({data})=>state.audits.push(data)}};
  `);
  try {
    esbuild.buildSync({stdin:{contents:`export {POST} from './app/api/internal/access-sync/route';export {state} from ${JSON.stringify(join(dir,"db.ts"))};`,resolveDir:process.cwd()},bundle:true,platform:"node",format:"cjs",outfile:join(dir,"test.cjs"),alias:{"@/lib/db/prisma":join(dir,"db.ts"),"server-only":join(dir,"empty.ts")},logLevel:"silent"});
    const {POST,state}=require(join(dir,"test.cjs")); let clock=Date.now()-10_000;
    const observation=(roleIds:string[])=>({discordId:state.user.discordId,roleIds,observedAt:new Date(++clock).toISOString(),trigger:"ROLE_UPDATE"});
    const post=(body:unknown,secret="test-secret")=>POST(new Request("http://localhost/api/internal/access-sync",{method:"POST",headers:{"x-londo-bot-secret":secret},body:JSON.stringify(body)}));
    assert.equal((await post(observation([process.env.OWNER_ROLE_ID!]),"bad")).status,401);
    await post(observation([process.env.MEMPHIS_RECRUIT_ROLE_ID!])); assert.equal(state.user.role,"USER"); assert.equal(state.updates,0); assert.equal(state.audits.length,0);
    await post(observation([process.env.DISCORD_HIGH_STAFF_ROLE_IDS!])); assert.equal(state.user.role,"USER","Discord addition never grants access");
    await post(observation([process.env.MEMPHIS_DEP_OWNER_ROLE_ID!])); assert.equal(state.user.role,"USER","Deputy access still requires approval"); assert.equal(state.user.accessSnapshot.memphisRole,"DEP_OWNER");
    // Non-curator Discord roles cannot manufacture an approved grant.
    state.user.role="HIGH_STAFF"; state.user.staffAccessGrants=[{id:"approved",role:"HIGH_STAFF",memphisRole:"HIGH_STAFF",phoenixRole:"USER",grantedAt:new Date(),grantedByUserId:"owner",sourceRequestId:"request"}];
    const old=observation([process.env.DISCORD_HIGH_STAFF_ROLE_IDS!]); await post(old); assert.equal(state.invalidated,0);
    await post(observation([process.env.MEMPHIS_RECRUIT_ROLE_ID!])); assert.equal(state.user.role,"RECRUIT"); assert.equal(state.invalidated,1);
    await post(observation([process.env.DISCORD_HIGH_STAFF_ROLE_IDS!,process.env.MEMPHIS_RECRUIT_ROLE_ID!])); assert.equal(state.user.role,"RECRUIT"); assert.equal(state.user.staffAccessGrants[0].memphisRole,"RECRUIT");
    await post(observation([])); assert.equal(state.user.role,"USER"); assert.equal(state.invalidated,2);
    await post(old); assert.equal(state.user.role,"USER","stale grant does not restore access");
    await post(observation([process.env.MEMPHIS_RECRUIT_ROLE_ID!])); assert.equal(state.user.role,"USER","role restored still needs another request");
    const count=state.updates,logs=state.audits.length;
    await post({...observation([process.env.OWNER_ROLE_ID!]),discordId:"100000000000000003"}); assert.equal(state.updates,count);
    assert.equal((await post([observation([]),{...observation([]),roleIds:undefined}])).status,400);
    state.user.discordId="100000000000000002";
    await post(observation([])); await post(observation([process.env.OWNER_ROLE_ID!])); assert.equal(state.updates,count); assert.equal(state.audits.length,logs);
    assert.deepEqual(state.audits.map((a:{action:string})=>a.action),["ACCESS_DOWNGRADED_DISCORD","ACCESS_REVOKED_DISCORD_ELIGIBILITY"]);
    state.user.discordId="100000000000000001";
    await post(observation([process.env.MEMPHIS_CUR_RECRUIT_ROLE_ID!]));
    assert.equal(state.user.role,"CURATOR");
    assert.equal(state.user.staffAccessGrants[0].role,"CURATOR");
    const curatorAndDeputy = observation([process.env.MEMPHIS_CUR_RECRUIT_ROLE_ID!, process.env.MEMPHIS_DEP_OWNER_ROLE_ID!]);
    assert.equal(resolveDiscordAccess(curatorAndDeputy.roleIds).role,"DEP_OWNER");
    await post(curatorAndDeputy);
    assert.equal(state.user.role,"CURATOR","higher Discord eligibility does not bypass access approval");
    await post(observation([]));
    assert.equal(state.user.role,"USER");
    assert.equal(state.user.staffAccessGrants.length,0);
    assert.equal(state.invalidated,3);
  } finally {
    if(originalFull===undefined)delete process.env.FULL_ACCESS_DISCORD_IDS;else process.env.FULL_ACCESS_DISCORD_IDS=originalFull;
    if(originalSecret===undefined)delete process.env.LONDO_BOT_API_SECRET;else process.env.LONDO_BOT_API_SECRET=originalSecret;
    rmSync(dir,{recursive:true,force:true});
  }
});
