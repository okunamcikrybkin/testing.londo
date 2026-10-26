import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAMILY_RANKS } from "../rank-appearance/catalog";
import { resolveDiscordAccess } from "./resolver";
import { parseAccessObservation } from "./protocol";
const id = (key: string) => FAMILY_RANKS.find(rank => rank.key === key)!.roleId;
const staffMapping = [
  ["OWNER", "1545123264668369040", "OWNER"],
  ["MEMPHIS_LEADER", "1545453391537242232", "HIGH_STAFF"],
  ["PHOENIX_LEADER", "1545123264655794265", "HIGH_STAFF"],
  ["MEMPHIS_HIGH_STAFF", "1545123264643473528", "RECRUIT"],
  ["PHOENIX_HIGH_STAFF", "1545123264643473527", "RECRUIT"],
  ["MEMPHIS_DEP_OWNER", "1545123264655794264", "RECRUIT"],
  ["PHOENIX_DEP_OWNER", "1545123264655794263", "RECRUIT"],
  ["MEMPHIS_CUR_RECRUIT", "1545123264643473526", "RECRUIT"],
  ["PHOENIX_CUR_RECRUIT", "1545123264643473525", "RECRUIT"],
  ["MEMPHIS_RECRUIT", "1545123264643473524", "RECRUIT"],
  ["PHOENIX_RECRUIT", "1545123264643473523", "RECRUIT"],
] as const;
for (const [key, roleId, expected] of staffMapping) test(`${key} → ${expected}, exact ID and isolated scope`, () => {
  assert.equal(id(key), roleId);
  const resolved = resolveDiscordAccess([roleId]);
  assert.equal(resolved.role, expected);
  assert.deepEqual(resolved.familyAccess, key === "OWNER" ? { MEMPHIS: "OWNER", PHOENIX: "OWNER" } : key.startsWith("MEMPHIS") ? { MEMPHIS: expected, PHOENIX: "USER" } : { MEMPHIS: "USER", PHOENIX: expected });
});
for (const key of ["MAIN", "LONDEST_LONDO", "LONDO", "YOUNG_LONDO", "BABY_LONDO", "NEWBIE"]) test(`${key} → USER`, () => {
  assert.deepEqual(resolveDiscordAccess([id(key)]), { role: "USER", familyAccess: { MEMPHIS: "USER", PHOENIX: "USER" } });
});
for (const [keys, expected] of [
  [["PHOENIX_LEADER", "PHOENIX_RECRUIT"], "HIGH_STAFF"],
  [["OWNER", "MEMPHIS_LEADER"], "OWNER"],
  [["MEMPHIS_HIGH_STAFF", "PHOENIX_CUR_RECRUIT"], "RECRUIT"],
  [["MEMPHIS_RECRUIT", "PHOENIX_RECRUIT"], "RECRUIT"],
  [[], "USER"],
] as const) test(`priority ${keys.join("+") || "none"}`, () => assert.equal(resolveDiscordAccess(keys.map(id)).role, expected));
test("unknown role ignored and both family scopes retained independently", () => {
  assert.deepEqual(resolveDiscordAccess(["999999999999999999"]), { role: "USER", familyAccess: { MEMPHIS: "USER", PHOENIX: "USER" } });
  assert.deepEqual(resolveDiscordAccess([id("MEMPHIS_LEADER"), id("PHOENIX_RECRUIT")]).familyAccess, { MEMPHIS: "HIGH_STAFF", PHOENIX: "RECRUIT" });
  assert.deepEqual(resolveDiscordAccess([id("MEMPHIS_HIGH_STAFF"), id("PHOENIX_CUR_RECRUIT")]).familyAccess, { MEMPHIS: "RECRUIT", PHOENIX: "RECRUIT" });
});
test("missing/stale/future/forged observations rejected", () => {
  const valid = { discordId: "100000000000000001", roleIds: [], observedAt: new Date().toISOString(), trigger: "ROLE_UPDATE" };
  for (const bad of [null, {}, { ...valid, roleIds: undefined }, { ...valid, observedAt: new Date(Date.now() - 121_000).toISOString() }, { ...valid, observedAt: new Date(Date.now() + 60_000).toISOString() }, { ...valid, role: "OWNER" }]) assert.throws(() => parseAccessObservation(bad));
});

test("endpoint only updates eligibility; existing grants downgrade/revoke, FULL_ACCESS stays protected", async () => {
  const require = createRequire(import.meta.url), esbuild = require("esbuild"), dir = mkdtempSync(join(tmpdir(), "access-sync-test-"));
  const originalFull = process.env.FULL_ACCESS_DISCORD_IDS, originalSecret = process.env.LONDO_BOT_API_SECRET;
  process.env.FULL_ACCESS_DISCORD_IDS = "100000000000000002"; process.env.LONDO_BOT_API_SECRET = "test-secret";
  writeFileSync(join(dir, "empty.ts"), "export {};");
  writeFileSync(join(dir, "db.ts"), `
    export const state={user:{id:'u',discordId:'100000000000000001',role:'USER',accessSnapshot:null,staffAccessGrants:[]},updates:0,audits:[],invalidated:0};
    export const prisma={$transaction:async fn=>fn(prisma),$executeRaw:async()=>0,
      user:{findUnique:async({where})=>where.discordId===state.user.discordId?state.user:null,update:async({data})=>{state.updates++;Object.assign(state.user,data);}},
      userAccessSnapshot:{upsert:async({create})=>{state.user.accessSnapshot=create;}},
      staffAccessGrant:{update:async()=>{state.user.staffAccessGrants=[];},create:async({data})=>{state.user.staffAccessGrants=[{id:'g',...data}];}},
      session:{updateMany:async()=>{state.invalidated++;}},auditLog:{create:async({data})=>state.audits.push(data)}};
  `);
  try {
    esbuild.buildSync({stdin:{contents:`export {POST} from './app/api/internal/access-sync/route';export {state} from ${JSON.stringify(join(dir,"db.ts"))};`,resolveDir:process.cwd()},bundle:true,platform:"node",format:"cjs",outfile:join(dir,"test.cjs"),alias:{"@/lib/db/prisma":join(dir,"db.ts"),"server-only":join(dir,"empty.ts")},logLevel:"silent"});
    const {POST,state}=require(join(dir,"test.cjs")); let clock=Date.now()-10_000;
    const observation=(keys:string[])=>({discordId:state.user.discordId,roleIds:keys.map(id),observedAt:new Date(++clock).toISOString(),trigger:"ROLE_UPDATE"});
    const post=(body:unknown,secret="test-secret")=>POST(new Request("http://localhost/api/internal/access-sync",{method:"POST",headers:{"x-londo-bot-secret":secret},body:JSON.stringify(body)}));
    assert.equal((await post(observation(["OWNER"]),"bad")).status,401);
    await post(observation(["PHOENIX_RECRUIT"])); assert.equal(state.user.role,"USER"); assert.equal(state.updates,0); assert.equal(state.audits.length,0);
    await post(observation(["PHOENIX_LEADER"])); assert.equal(state.user.role,"USER","Discord addition never grants access");
    // An approved grant is an independent input, not manufactured by Discord sync.
    state.user.role="HIGH_STAFF"; state.user.staffAccessGrants=[{id:"approved",role:"HIGH_STAFF",memphisRole:"USER",phoenixRole:"HIGH_STAFF",grantedAt:new Date(),grantedByUserId:"owner",sourceRequestId:"request"}];
    const old=observation(["PHOENIX_LEADER"]); await post(old);
    await post(observation(["PHOENIX_RECRUIT"])); assert.equal(state.user.role,"RECRUIT"); assert.equal(state.invalidated,1);
    await post(observation(["PHOENIX_LEADER","MEMPHIS_RECRUIT"])); assert.equal(state.user.role,"RECRUIT"); assert.equal(state.user.staffAccessGrants[0].memphisRole,"USER","new family needs approval");
    await post(observation([])); assert.equal(state.user.role,"USER"); assert.equal(state.invalidated,2);
    await post(old); assert.equal(state.user.role,"USER","stale grant does not restore access");
    await post(observation(["PHOENIX_RECRUIT"])); assert.equal(state.user.role,"USER","role restored still needs another request");
    const count=state.updates,logs=state.audits.length;
    await post({...observation(["OWNER"]),discordId:"100000000000000003"}); assert.equal(state.updates,count);
    assert.equal((await post([observation([]),{...observation([]),roleIds:undefined}])).status,400);
    state.user.discordId="100000000000000002";
    await post(observation([])); await post(observation(["OWNER"])); assert.equal(state.updates,count); assert.equal(state.audits.length,logs);
    assert.deepEqual(state.audits.map((a:{action:string})=>a.action),["ACCESS_DOWNGRADED_DISCORD","ACCESS_REVOKED_DISCORD_ELIGIBILITY"]);
  } finally {
    if(originalFull===undefined)delete process.env.FULL_ACCESS_DISCORD_IDS;else process.env.FULL_ACCESS_DISCORD_IDS=originalFull;
    if(originalSecret===undefined)delete process.env.LONDO_BOT_API_SECRET;else process.env.LONDO_BOT_API_SECRET=originalSecret;
    rmSync(dir,{recursive:true,force:true});
  }
});
