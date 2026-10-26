import test from "node:test";
import assert from "node:assert/strict";
import { canManage, cooldownEnd, historyScope, prizeInput, requireAdmin, requirePlayer, settingsInput, spinInput } from "./rules";
import { selectPrize } from "./random";
import { pointerIndex, winningRotation } from "./wheel";
const user={id:"u",discordId:"d",effectiveAccess:"FAMQ",status:"ACTIVE"};
test("roulette requires an active authenticated user; admin access is OWNER/FULL_ACCESS",()=>{
  assert.throws(()=>requirePlayer(null));assert.throws(()=>requirePlayer({...user,status:"BANNED"}));assert.doesNotThrow(()=>requirePlayer(user));
  for(const effectiveAccess of ["USER","RECRUIT","HIGH_STAFF"])assert.throws(()=>requireAdmin({...user,effectiveAccess}));
  for(const effectiveAccess of ["OWNER","FULL_ACCESS"])assert.ok(canManage({...user,effectiveAccess}));
});
test("history always scopes players to themselves; global history requires admin",()=>{
  assert.deepEqual(historyScope(user),{userId:"u"});assert.throws(()=>historyScope(user,true));assert.deepEqual(historyScope({...user,effectiveAccess:"OWNER"},true),{});
});
test("client may submit only spin type and idempotency key",()=>{
  const input={spinType:"FREE",requestId:"1234567890123456"};assert.deepEqual(spinInput(input),input);
  for(const body of [{...input,prizeId:"attacker"},{...input,price:0},{...input,coinAmount:999},{...input,weight:1},{...input,requestId:"short"},{...input,spinType:"ROLE"},null])assert.throws(()=>spinInput(body));
});
test("settings validate decimal prices and cooldown boundaries",()=>{
  assert.deepEqual(settingsInput({isEnabled:true,paidSpinPrice:"25.0001",freeSpinCooldownHours:24}),{isEnabled:true,paidSpinPrice:"25.0001",freeSpinCooldownHours:24});
  for(const patch of [{paidSpinPrice:-1},{paidSpinPrice:"NaN"},{paidSpinPrice:"0.00001"},{freeSpinCooldownHours:0},{freeSpinCooldownHours:1.5},{isEnabled:"true"}])assert.throws(()=>settingsInput({isEnabled:true,paidSpinPrice:25,freeSpinCooldownHours:24,...patch}));
  assert.equal(cooldownEnd(new Date("2026-10-24T12:00:00Z"),24)?.toISOString(),"2026-10-25T12:00:00.000Z");
});
test("prize input validates each fulfillment type and clears irrelevant fields",()=>{
  const base={name:" Prize ",description:"",type:"COINS",weight:50,isActive:true,sortOrder:0,coinAmount:"500",discordRoleId:"123456789012345678"};
  assert.equal(prizeInput(base).name,"Prize");assert.equal(prizeInput(base).discordRoleId,null);
  assert.equal(prizeInput({...base,type:"DISCORD_ROLE"}).coinAmount,null);
  assert.equal(prizeInput({...base,type:"MANUAL",manualText:"Claim from owner"}).manualText,"Claim from owner");
  for(const patch of [{weight:0},{weight:1.1},{weight:1000001},{coinAmount:"0"},{type:"MANUAL"},{type:"DISCORD_ROLE",discordRoleId:"abc"},{type:"UNKNOWN"},{name:""}])assert.throws(()=>prizeInput({...base,...patch}));
});
test("secure weighted selection follows exact intervals; inactive/deleted never win",()=>{
  const prizes=[{id:"a",weight:50,isActive:true},{id:"b",weight:25,isActive:true},{id:"inactive",weight:999,isActive:false},{id:"deleted",weight:999,isActive:true,deletedAt:new Date()},{id:"c",weight:15,isActive:true},{id:"d",weight:10,isActive:true}];
  const counts:Record<string,number>={};for(let n=0;n<100;n++){const p=selectPrize(prizes,((max:number)=>{assert.equal(max,100);return n;}) as typeof import("node:crypto").randomInt);counts[p.id]=(counts[p.id]||0)+1;}assert.deepEqual(counts,{a:50,b:25,c:15,d:10});
  for(let n=0;n<100;n++)assert.ok(["a","b","c","d"].includes(selectPrize(prizes).id));assert.throws(()=>selectPrize([]));assert.throws(()=>selectPrize([{weight:0,isActive:true}]));
});
test("every winning prize maps to the pointer for 1–24 sectors and successive rotations",()=>{
  for(let n=1;n<=24;n++){const prizes=Array.from({length:n},(_,i)=>({id:String(i),name:String(i),type:"COINS"}));let current=0;for(let pass=0;pass<3;pass++)for(let i=0;i<n;i++){const next=winningRotation(prizes,String(i),current);assert.ok(next-current>=2160);assert.equal(pointerIndex(next,n),i);current=next;}}
  assert.throws(()=>winningRotation([],"missing",0));
});
