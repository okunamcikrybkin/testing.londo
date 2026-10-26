import assert from "node:assert/strict";
import { createHash,randomBytes,randomUUID } from "node:crypto";
import { spawn,spawnSync,type ChildProcess } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
async function main(){
 loadEnvConfig(process.cwd(),true,{info(){},error(){}});const schema="economy_test_"+randomUUID().replaceAll("-","");assert.match(schema,/^economy_test_[a-f0-9]{32}$/);
 const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("schema",schema);const baseDb=new PrismaClient(),db=new PrismaClient({datasourceUrl:url.toString()});let created=false,server:ChildProcess|undefined;const base="http://127.0.0.1:3196",tokens:Record<string,string>={};
 try{
  await baseDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);created=true;
  const diff=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","diff","--from-empty","--to-schema-datamodel","prisma/schema.prisma","--script"],{encoding:"utf8",timeout:60000});assert.equal(diff.status,0);
  const tables=["users","sessions","discord_identities","family_memberships","voice_profiles","economy_transactions","audit_logs"];
  for(const sql of diff.stdout.replace(/^--.*$/gm,"").split(";").map(s=>s.trim()).filter(Boolean)){const table=/CREATE TABLE "([^"]+)"/.exec(sql)?.[1]||/ ON "([^"]+)"/.exec(sql)?.[1]||/ALTER TABLE "([^"]+)"/.exec(sql)?.[1];if(sql.startsWith("CREATE TYPE")||table&&tables.includes(table))await db.$executeRawUnsafe(sql);}
  for(const [index,name] of ["full","owner","staff","recruit","user"].entries()){
   const discordId=String(BigInt("800000000000000000")+BigInt(index));await db.user.create({data:{id:name,discordId,username:name,displayName:name,role:name==="owner"?"OWNER":name==="staff"?"HIGH_STAFF":name==="recruit"?"RECRUIT":"USER"}});tokens[name]=randomBytes(32).toString("hex");await db.session.create({data:{userId:name,tokenHash:createHash("sha256").update(tokens[name]).digest("hex"),expiresAt:new Date(Date.now()+3600000)}});
  }
  const target="800000000000000099";
  await db.discordIdentity.create({data:{discordUserId:target,username:"discord_target",displayName:"Test Target",gameNickname:"Game Nick",staticId:"static42"}});
  await db.familyMembership.create({data:{discordUserId:target,family:"MEMPHIS",active:true,lastSyncedAt:new Date()}});
  server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3196","-H","127.0.0.1"],{env:{...process.env,NODE_ENV:"production",DATABASE_URL:url.toString(),FULL_ACCESS_DISCORD_IDS:"800000000000000000"},stdio:["ignore","pipe","pipe"],windowsHide:true});server.stdout?.resume();server.stderr?.resume();
  for(let n=0;n<60;n++){try{if((await fetch(base+"/api/economy/history")).status===403)break;}catch{/* wait for local startup */}if(n===59)throw Error("SERVER_START_FAILED");await new Promise(r=>setTimeout(r,500));}
  async function http(path:string,who:string|null="full",method="GET",body?:object,status=200){const r=await fetch(base+path,{method,redirect:"manual",headers:{"content-type":"application/json",origin:base,...(who?{cookie:"atemii_session="+tokens[who]}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,status,method+" "+path+" "+who);return r;}
  for(const who of [null,"owner","staff","recruit","user"]){for(const path of ["/api/economy/users?q=Test","/api/economy/history","/api/economy/grant","/api/economy/debit"]){const post=path.endsWith("grant")||path.endsWith("debit");await http(path,who,post?"POST":"GET",post?{}:undefined,403);}await http("/economy",who,"GET",undefined,307);}
  assert.match(await(await http("/economy")).text(),/Управление экономикой/);
  for(const q of [target,"discord_target","Test Target","Game Nick","static42"]){const found=await(await http("/api/economy/users?"+new URLSearchParams({q}))).json();assert.ok(found.some((u:{discordId:string;families:string[]})=>u.discordId===target&&u.families.includes("MEMPHIS")));}
  const body={targetDiscordId:target,amount:"25.125",reason:"  Integration correction  ",requestId:randomUUID()};
  const grant=await(await http("/api/economy/grant","full","POST",body)).json();assert.equal(grant.balance,"25.125");assert.equal(grant.transaction.metadata.actorDiscordId,"800000000000000000");assert.equal(grant.transaction.metadata.reason,"Integration correction");
  assert.equal((await(await http("/api/economy/grant","full","POST",body)).json()).transaction.id,grant.transaction.id);
  await http("/api/economy/debit","full","POST",body,409);
  for(const amount of [0,-1,"NaN","1000001","1.00001"]){await http("/api/economy/grant","full","POST",{...body,amount,requestId:randomUUID()},400);}
  await http("/api/economy/grant","full","POST",{...body,targetDiscordId:"899999999999999999",requestId:randomUUID()},404);
  const results=await Promise.all([0,1].map(()=>fetch(base+"/api/economy/debit",{method:"POST",headers:{"content-type":"application/json",origin:base,cookie:"atemii_session="+tokens.full},body:JSON.stringify({...body,amount:"20",requestId:randomUUID()})})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await db.voiceProfile.findUniqueOrThrow({where:{discordUserId:target}})).balance.toString(),"5.125");
  assert.equal(await db.economyTransaction.count(),2);assert.equal(await db.auditLog.count(),2);const audit=await db.auditLog.findFirstOrThrow({where:{action:"ECONOMY_ADMIN_GRANT"}});assert.equal(audit.actorId,"full");assert.equal((audit.metadata as {transactionId:string}).transactionId,grant.transaction.id);
  const history=await(await http("/api/economy/history?"+new URLSearchParams({target,operation:"DEBIT",date:new Date().toISOString().slice(0,10)}))).json();assert.equal(history.total,1);assert.equal(history.transactions[0].metadata.operation,"DEBIT");
  const csrf=await fetch(base+"/api/economy/grant",{method:"POST",headers:{"content-type":"application/json",cookie:"atemii_session="+tokens.full,origin:"https://untrusted.invalid"},body:JSON.stringify(body)});assert.equal(csrf.status,403);
  console.log("PASS: all four endpoints deny anonymous/OWNER/HIGH_STAFF/RECRUIT/USER; existing resolver admits FULL_ACCESS. Page access, all search fields, decimal grant/debit, real concurrent debit, idempotency, ledger/audit/reason, history filters and CSRF passed.");
 }finally{
  if(server&&server.exitCode===null){const exited=new Promise<void>(resolve=>server!.once("exit",()=>resolve()));server.kill();await exited;}
  await db.$disconnect();if(created){assert.match(schema,/^economy_test_[a-f0-9]{32}$/);await baseDb.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);console.log("Temporary economy test schema removed; real balances untouched.");}await baseDb.$disconnect();
 }
}
main().catch(e=>{console.error({name:e.name,code:e.code,assertion:e.operator,actual:e.actual,expected:e.expected,message:e.name==="AssertionError"?e.message:undefined});process.exitCode=1;});
