import {test} from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {seal,unseal} from "./crypto";
import {matchGuilds,publicApplyUrl,validateWatchlist} from "./policy";
import {readGuilds,tokenRequest} from "./discord-api";
const gid="1545123264605585438";
test("encrypted credentials round trip and authenticated tamper rejection",()=>{
 const previous=process.env.DISCORD_OAUTH_ENCRYPTION_KEY;process.env.DISCORD_OAUTH_ENCRYPTION_KEY=randomBytes(32).toString("hex");
 try{const token={access_token:"test-access",refresh_token:"test-refresh"},encrypted=seal(token);assert.ok(!encrypted.includes("test-access"));assert.deepEqual(unseal(encrypted),token);const parts=encrypted.split(".");parts[2]=(parts[2][0]==="A"?"B":"A")+parts[2].slice(1);assert.throws(()=>unseal(parts.join(".")));}finally{if(previous===undefined)delete process.env.DISCORD_OAUTH_ENCRYPTION_KEY;else process.env.DISCORD_OAUTH_ENCRYPTION_KEY=previous;}
});
test("watchlist string snowflakes, unique identity and validated invite",()=>{
 assert.equal(validateWatchlist({guildId:gid,name:" LONDO ",enabled:true}).guildId,gid);
 for(const input of [{guildId:Number(gid),name:"a",enabled:true},{guildId:gid,name:"",enabled:true},{guildId:gid,name:"a",enabled:true,inviteUrl:"javascript:alert(1)"},{guildId:gid,name:"a",enabled:true,inviteUrl:"https://evil.test"}])assert.throws(()=>validateWatchlist(input));
 assert.equal(validateWatchlist({guildId:gid,name:"A",enabled:false,inviteUrl:"https://discord.gg/example"}).enabled,false);
});
test("active watchlist matches by ID, disabled ignored, matches first for either family",()=>{
 const rows=[{id:"1",name:"same",icon:null,roles:null,roleStatus:"UNAVAILABLE" as const},{id:"2",name:"different",icon:null,roles:[],roleStatus:"AVAILABLE" as const}];
 assert.deepEqual(matchGuilds(rows,[{guildId:"2",enabled:true},{guildId:"1",enabled:false}]).map(r=>[r.id,r.matched]),[["2",true],["1",false]]);
 assert.equal(matchGuilds(rows,[{guildId:"2",enabled:false}]).filter(r=>r.matched).length,0);
});
test("public URL rejects absent, localhost, HTTP and credential-bearing URLs",()=>{
 for(const url of ["","http://londo.test","https://localhost","https://127.0.0.1","https://user:pass@londo.test"])assert.equal(publicApplyUrl(url),null);
 assert.equal(publicApplyUrl("https://londo.example/base"),"https://londo.example/apply");
});
test("guilds scope absence makes no API call",async()=>{let calls=0;await assert.rejects(readGuilds("test","identify",async()=>{calls++;return new Response("[]");}));assert.equal(calls,0);});
test("listing guilds never reads member roles even with all scopes",async()=>{
 const calls:string[]=[];const rows=await readGuilds("test","identify guilds guilds.members.read",async input=>{calls.push(String(input));return Response.json([{id:gid,name:"Test"}]);});
 assert.equal(calls.length,1);assert.ok(!calls[0].includes("/member"));assert.equal(rows[0].roles,null);assert.equal(rows[0].roleStatus,"NOT_CHECKED");
});
test("guilds without member scope never queries roles",async()=>{let calls=0;const rows=await readGuilds("test","guilds",async()=>{calls++;return Response.json([{id:gid,name:"Test"}]);});assert.equal(calls,1);assert.equal(rows[0].roles,null);});
test("Discord unavailable, revoked token and rate limit never produce empty guild results",async()=>{
 for(const status of [401,429,500])await assert.rejects(readGuilds("test","guilds",async()=>new Response("{}",{status})));
});
test("refresh token uses official grant and handles revocation",async()=>{
 let body="";const r=await tokenRequest({grant_type:"refresh_token",refresh_token:"test"},async(_,options)=>{body=String(options?.body);return Response.json({access_token:"new",refresh_token:"rotated",scope:"guilds",expires_in:3600});});assert.match(body,/grant_type=refresh_token/);assert.equal(r.refresh_token,"rotated");await assert.rejects(tokenRequest({grant_type:"refresh_token",refresh_token:"old"},async()=>new Response("{}",{status:400})));
});
