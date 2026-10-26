import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

// Entire HTTP/DB test runs in its own temporary PostgreSQL schema with synthetic identities.
// It never changes production/dev user balances, settings, prizes or Discord roles.
async function main() {
  loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const original=process.env.DATABASE_URL;if(!original)throw Error("DATABASE_NOT_CONFIGURED");
  const schema="roulette_test_"+randomUUID().replaceAll("-","");
  assert.match(schema,/^roulette_test_[a-f0-9]{32}$/);
  const url=new URL(original);url.searchParams.set("schema",schema);
  const baseDb=new PrismaClient(),db=new PrismaClient({datasourceUrl:url.toString()});
  let created=false,server:ChildProcess|undefined;
  const base="http://127.0.0.1:3198",tokens:Record<string,string>={};let deliveryFails=true;
  const secret=randomBytes(32).toString("hex");
  const bot=createServer((req,res)=>{
    if(req.url?.startsWith("/login/")){
      const who=req.url.slice(7);if(!tokens[who]){res.writeHead(404);res.end();return;}
      res.writeHead(302,{"set-cookie":`atemii_session=${tokens[who]}; HttpOnly; SameSite=Lax; Path=/`,location:base+"/roulette"});res.end();return;
    }
    if(req.headers["x-londo-bot-secret"]!==secret){res.writeHead(401);res.end();return;}
    res.setHeader("content-type","application/json");
    if(req.url==="/internal/discord/shop/options"){res.end(JSON.stringify({roles:[{id:"234567890123456789",name:"Test reward",position:1}],channels:[]}));return;}
    res.statusCode=deliveryFails?503:200;res.end(JSON.stringify({code:deliveryFails?"PENDING":"ALREADY_OWNED"}));
  });
  try {
    await baseDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);created=true;
    const diff=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","diff","--from-empty","--to-schema-datamodel","prisma/schema.prisma","--script"],{encoding:"utf8",timeout:60000});
    assert.equal(diff.status,0,"Generate isolated schema DDL");
    const tables=["users","sessions","voice_profiles","economy_transactions","audit_logs","roulette_settings","roulette_prizes","roulette_spins"];
    for(const sql of diff.stdout.replace(/^--.*$/gm,"").split(";").map(s=>s.trim()).filter(Boolean)){
      const table=/CREATE TABLE "([^"]+)"/.exec(sql)?.[1]||/ ON "([^"]+)"/.exec(sql)?.[1]||/ALTER TABLE "([^"]+)"/.exec(sql)?.[1];
      if(sql.startsWith("CREATE TYPE")||(table&&tables.includes(table)))await db.$executeRawUnsafe(sql);
    }
    await db.rouletteSettings.create({data:{id:"global"}});
    for(const [index,who] of ["owner","player","other"].entries()){
      const user=await db.user.create({data:{id:who,discordId:String(BigInt("800000000000000000")+BigInt(index)),username:who,displayName:"Roulette test "+who,role:who==="owner"?"OWNER":"USER"}});
      tokens[who]=randomBytes(32).toString("hex");await db.session.create({data:{userId:user.id,tokenHash:createHash("sha256").update(tokens[who]).digest("hex"),expiresAt:new Date(Date.now()+3600000)}});
    }
    await new Promise<void>(resolve=>bot.listen(3199,"127.0.0.1",resolve));
    server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3198","-H","127.0.0.1"],{env:{...process.env,NODE_ENV:"production",DATABASE_URL:url.toString(),LONDO_BOT_INTERNAL_URL:"http://127.0.0.1:3199",LONDO_BOT_API_SECRET:secret},stdio:["ignore","pipe","pipe"],windowsHide:true});
    // Consume server output without exposing env/connection strings on failures.
    server.stdout?.resume();server.stderr?.resume();
    for(let n=0;n<60;n++){try{const r=await fetch(base+"/api/roulette");if(r.status===401)break;}catch{}if(n===59)throw Error("TEST_SERVER_START_FAILED");await new Promise(r=>setTimeout(r,500));}
    async function http(path:string,who:string|null="player",method="GET",body?:object,expected=200){
      const r=await fetch(base+path,{method,redirect:"manual",headers:{"content-type":"application/json",origin:base,...(who?{cookie:"atemii_session="+tokens[who]}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,expected,method+" "+path);return r;
    }
    for(const path of ["/roulette","/roulette/admin","/roulette/admin/history","/roulette/admin/prizes/new"]){const r=await http(path,null,"GET",undefined,307);assert.ok(r.headers.get("location"));}
    for(const path of ["/api/roulette","/api/roulette/spin","/api/roulette/admin/settings","/api/roulette/admin/prizes"]){await http(path,null,path.includes("settings")?"PATCH":path.endsWith("spin")||path.endsWith("prizes")?"POST":"GET",path==="/api/roulette"?undefined:{},401);}
    const page=await http("/roulette");assert.match(await page.text(),/LONDO[\s\S]*ROULETTE/);
    await http("/api/roulette/admin/settings","player","PATCH",{},403);await http("/api/roulette/admin/prizes","player","POST",{},403);
    for(const path of ["/roulette/admin","/roulette/admin/history","/roulette/admin/prizes/new"]){const r=await fetch(base+path,{redirect:"manual",headers:{cookie:"atemii_session="+tokens.player}});const html=await r.text();assert.ok(r.headers.get("location")==="/roulette"||html.includes('url=/roulette'),"Admin page redirects ordinary user");}
    const spin=(who:string,spinType:string,requestId=randomUUID(),status=200)=>http("/api/roulette/spin",who,"POST",{spinType,requestId},status).then(r=>r.json());
    await spin("player","FREE",randomUUID(),409); // no prizes
    const prizeInput={name:"Integration prize",description:"Test only",type:"MANUAL",manualText:"Contact the owner",weight:50,isActive:true,sortOrder:0};
    const p=await (await http("/api/roulette/admin/prizes","owner","POST",prizeInput)).json();
    // First-ever profile creation races too: no pre-existing balance/profile row.
    const free=await Promise.all([0,1].map(()=>fetch(base+"/api/roulette/spin",{method:"POST",headers:{"content-type":"application/json",cookie:"atemii_session="+tokens.player,origin:base},body:JSON.stringify({spinType:"FREE",requestId:randomUUID()})})));
    assert.deepEqual(free.map(r=>r.status).sort(),[200,409]);assert.equal(await db.rouletteSpin.count({where:{userId:"player",spinType:"FREE"}}),1);
    console.log("PASS: real PostgreSQL concurrent first free claim (one success, one cooldown).");
    await db.voiceProfile.update({where:{discordUserId:"800000000000000001"},data:{balance:30}});
    const paid=await Promise.all([0,1].map(()=>fetch(base+"/api/roulette/spin",{method:"POST",headers:{"content-type":"application/json",cookie:"atemii_session="+tokens.player,origin:base},body:JSON.stringify({spinType:"PAID",requestId:randomUUID()})})));
    assert.deepEqual(paid.map(r=>r.status).sort(),[200,409]);assert.equal((await db.voiceProfile.findUniqueOrThrow({where:{discordUserId:"800000000000000001"}})).balance.toString(),"5");
    console.log("PASS: real PostgreSQL concurrent paid debit cannot overspend.");
    await db.voiceProfile.update({where:{discordUserId:"800000000000000001"},data:{balance:100}});
    const key=randomUUID();const [a,b]=await Promise.all([spin("player","PAID",key),spin("player","PAID",key)]);assert.equal(a.spin.id,b.spin.id);assert.equal((await db.voiceProfile.findUniqueOrThrow({where:{discordUserId:"800000000000000001"}})).balance.toString(),"75");
    await http("/api/roulette/admin/history/"+a.spin.id,"player","POST",{action:"complete"},403);
    await http("/api/roulette/admin/history/"+a.spin.id,"owner","POST",{action:"complete"});await http("/api/roulette/admin/history/"+a.spin.id,"owner","POST",{action:"complete"});
    await http("/api/roulette/admin/prizes/"+p.id,"owner","PATCH",{...prizeInput,type:"COINS",coinAmount:"50"});
    const coin=await spin("player","PAID");assert.equal(coin.spin.status,"COMPLETED");assert.equal((await db.voiceProfile.findUniqueOrThrow({where:{discordUserId:"800000000000000001"}})).balance.toString(),"100");
    const ledger=await db.economyTransaction.findMany({where:{metadata:{path:["rouletteSpinId"],equals:coin.spin.id}}});assert.equal(ledger.length,2);
    await http("/api/roulette/admin/prizes/"+p.id,"owner","PATCH",{...prizeInput,type:"DISCORD_ROLE",discordRoleId:"234567890123456789"});
    const role=await spin("other","FREE");assert.equal(role.spin.status,"PENDING_DELIVERY");deliveryFails=false;
    const retried=await (await http("/api/roulette/admin/history/"+role.spin.id,"owner","POST",{action:"retry"})).json();assert.equal(retried.status,"COMPLETED");assert.match(retried.deliveryNote,/уже была/);
    const own=await (await http("/api/roulette")).json();assert.ok(own.history.every((s:{userId:string})=>s.userId==="player"));assert.equal(own.history.some((s:{id:string})=>s.id===role.spin.id),false);
    assert.ok((await (await http("/roulette/admin/history?user=800000000000000002","owner")).text()).includes("Roulette test other"));
    await http("/api/roulette/admin/settings","owner","PATCH",{isEnabled:false,paidSpinPrice:"30.0001",freeSpinCooldownHours:12});await spin("player","PAID",randomUUID(),409);
    assert.equal((await spin("player","PAID",key)).spin.id,a.spin.id); // retry returns original despite disable/catalog edit
    await http("/api/roulette/admin/prizes/"+p.id,"owner","DELETE",{});assert.ok((await db.roulettePrize.findUniqueOrThrow({where:{id:p.id}})).deletedAt);assert.equal((await db.rouletteSpin.findUniqueOrThrow({where:{id:a.spin.id}})).prizeName,"Integration prize");
    const csrf=await fetch(base+"/api/roulette/spin",{method:"POST",headers:{"content-type":"application/json",cookie:"atemii_session="+tokens.player,origin:"https://untrusted.invalid"},body:JSON.stringify({spinType:"FREE",requestId:randomUUID()})});assert.equal(csrf.status,403);
    console.log("PASS: authenticated pages, admin authorization/CRUD, settings, idempotency, coin ledger, manual fulfillment, pending role retry, private history, CSRF.");
    if(process.env.ROULETTE_UI_REVIEW==="1"){
      await db.rouletteSettings.update({where:{id:"global"},data:{isEnabled:true,paidSpinPrice:25,freeSpinCooldownHours:24}});
      for(const [i,name] of ["500 монет","Роль семьи","Сувенир LONDO","100 монет","Приятный бонус","Попробуй ещё"].entries())await db.roulettePrize.create({data:{name,type:i===5?"NOTHING":"COINS",coinAmount:i===5?null:100,weight:10,sortOrder:i}});
      await db.voiceProfile.upsert({where:{discordUserId:"800000000000000000"},create:{discordUserId:"800000000000000000",balance:1250},update:{balance:1250}});
      console.log("UI review ready: http://127.0.0.1:3199/login/owner (isolated synthetic account). Send newline to clean up.");
      await new Promise<void>(resolve=>process.stdin.once("data",()=>resolve()));
      process.stdin.pause();
    }
  } finally {
    server?.kill();if(server&&server.exitCode===null)await new Promise<void>(resolve=>{server!.once("exit",()=>resolve());setTimeout(resolve,5000);});
    bot.closeAllConnections();await new Promise<void>(resolve=>bot.close(()=>resolve()));await db.$disconnect();
    if(created){assert.match(schema,/^roulette_test_[a-f0-9]{32}$/);await baseDb.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);console.log("Temporary test schema removed; real economy untouched.");}
    await baseDb.$disconnect();
  }
}
main().catch(e=>{console.error({name:e.name,code:e.code,assertion:e.operator,actual:e.actual,expected:e.expected,message:e.name==="AssertionError"?e.message:undefined});process.exitCode=1;});
