import {test} from "node:test";
import assert from "node:assert/strict";
import {readMemberRoles} from "./member-roles";
import {roleMessage} from "./role-display";
import {RoleQueue} from "./role-queue";
import {hasFreshRoles,visibleRoles,ROLE_CACHE_MS,type GuildResult} from "./policy";
const id="1545123264605585439";
const row:GuildResult={id,name:"Test",icon:null,roles:null,roleStatus:"NOT_CHECKED"};
test("on-demand member request uses Bearer and preserves IDs and genuine empty roles",async()=>{
 for(const roles of [[],[id]]){const result=await readMemberRoles(row,"test-token","guilds guilds.members.read",new RoleQueue(),async(input,init)=>{
 assert.equal((init?.headers as Record<string,string>).authorization,"Bearer test-token");assert.match(String(input),/users\/@me\/guilds\/\d+\/member$/);return Response.json({roles});});assert.deepEqual(result.roles,roles);assert.match(roleMessage(result),roles.length?/Роли получены/:/Ролей нет/);}
});
test("missing member scope makes no request and asks for consent",async()=>{let calls=0;const result=await readMemberRoles(row,"test","guilds",new RoleQueue(),async()=>{calls++;return Response.json({});});assert.equal(calls,0);assert.equal(result.roleStatus,"MISSING_SCOPE");});
test("HTTP errors retain distinct states and no empty roles",async()=>{
 for(const [status,expected] of [[403,"API_ERROR"],[500,"API_ERROR"],[404,"UNAVAILABLE"],[401,"RECONSENT_REQUIRED"],[429,"RATE_LIMITED"]] as const){const result=await readMemberRoles(row,"test","guilds.members.read",new RoleQueue(),async()=>Response.json({code:50001,retry_after:60},{status}));assert.equal(result.roles,null);assert.equal(result.roleStatus,expected);assert.equal(result.roleHttpStatus,status);assert.equal(result.roleErrorCode,50001);}
});
test("malformed roles and network failures never become no roles",async()=>{
 for(const malformed of [true,false]){const result=await readMemberRoles(row,"test","guilds.members.read",new RoleQueue(),async()=>{if(malformed)return Response.json({roles:[42]});throw Error("network");});assert.equal(result.roles,null);assert.equal(result.roleStatus,"UNAVAILABLE");}
});
test("queue deduplicates concurrent calls and successful cache expires",async()=>{
 let now=0,calls=0;const queue=new RoleQueue(()=>now);const transport:typeof fetch=async()=>{calls++;return Response.json({roles:[id]});};
 await Promise.all([1,2,3].map(()=>readMemberRoles(row,"test","guilds.members.read",queue,transport)));assert.equal(calls,1);
 await readMemberRoles(row,"test","guilds.members.read",queue,transport);assert.equal(calls,1);now=ROLE_CACHE_MS+1;
 await readMemberRoles(row,"test","guilds.members.read",queue,transport);assert.equal(calls,2);
});
test("Retry-After pauses all guild role requests without retry storm or caching false empty",async()=>{
 let now=0,calls=0;const queue=new RoleQueue(()=>now);const transport:typeof fetch=async()=>{calls++;return Response.json({retry_after:3},{status:429,headers:{"Retry-After":"5","X-RateLimit-Reset-After":"4"}});};
 assert.equal((await readMemberRoles(row,"test","guilds.members.read",queue,transport)).roleStatus,"RATE_LIMITED");now=4999;
 assert.equal((await readMemberRoles({...row,id:"1545123264605585440"},"test","guilds.members.read",queue,transport)).roleStatus,"RATE_LIMITED");assert.equal(calls,1);
 now=5000;const success=await readMemberRoles(row,"test","guilds.members.read",queue,async()=>{calls++;return Response.json({roles:[id]});});assert.equal(calls,2);assert.deepEqual(success.roles,[id]);
});
test("remaining zero observes fractional Reset-After before next request",async()=>{
 let now=0,calls=0;const queue=new RoleQueue(()=>now);const job=async()=>{calls++;const r=Response.json({}, {headers:{"X-RateLimit-Remaining":"0","X-RateLimit-Reset-After":"1.5"}});queue.observe(r,{});};await queue.run("a",job);now=1499;await assert.rejects(queue.run("b",job));assert.equal(calls,1);now=1500;await queue.run("b",job);assert.equal(calls,2);
});
test("queue runs distinct guilds sequentially",async()=>{const queue=new RoleQueue();let active=0,max=0;await Promise.all(["a","b","c"].map(key=>queue.run(key,async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;})));assert.equal(max,1);});
test("snapshot cache expires and old errors are never shown as empty roles",()=>{
 const now=Date.now();const cached={...row,roles:[],roleStatus:"AVAILABLE" as const,roleCheckedAt:new Date(now).toISOString()};assert.equal(hasFreshRoles(cached,now),true);assert.equal(visibleRoles(cached,now+ROLE_CACHE_MS).roleStatus,"NOT_CHECKED");assert.equal(visibleRoles({...row,roleStatus:"RATE_LIMITED",roleCheckedAt:new Date(now).toISOString()},now).roles,null);assert.equal(roleMessage(row),"Не проверялось");
});
