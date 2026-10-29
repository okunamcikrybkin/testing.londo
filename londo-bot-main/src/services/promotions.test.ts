import test from "node:test";
import assert from "node:assert/strict";
import {applyRolePlan,availableRanks,promotionModal,promotionPanel,previewChunks,protectedPromotionRoles,safePromotionRole,type PromotionRank} from "./promotions.js";
import {setPromotionRanks,resolvePromotionRank} from "./promotionRanks.js";
import {PromotionsManager} from "./promotions.js";
import {Collection,ChannelType,type Guild,type Interaction} from "discord.js";
import type {ApplicationConfig} from "../types/family.js";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const rank:PromotionRank={id:"rank1",family:"MEMPHIS",name:"Тестовый ранг",description:"Описание",discordRoleId:"target",sortOrder:1,isActive:true,isPosition:false,version:1,criteria:[{text:"Проверка",isRequired:true,sortOrder:0}],questions:[{id:"q1",label:"Причина",placeholder:null,type:"PARAGRAPH",required:true,minLength:1,maxLength:100,sortOrder:0}]};
test("family select includes only active ranks in its family",()=>{assert.deepEqual(availableRanks([rank,{...rank,id:"other",family:"PHOENIX"},{...rank,id:"off",isActive:false},{...rank,id:"deleted",deletedAt:"2026"}],"MEMPHIS").map(r=>r.id),["rank1"]);});
test("criteria preview is ordered, complete and split below Discord limits",()=>{const long={...rank,criteria:Array.from({length:20},(_,i)=>({text:String(i)+"x".repeat(500),sortOrder:19-i,isRequired:true}))};const chunks=previewChunks(long);assert.ok(chunks.length>1);assert.ok(chunks.every(c=>c.length<=1800));assert.ok(chunks.join("").includes("19xxx"));assert.ok(chunks.join("").indexOf("19xxx")<chunks.join("").indexOf("0xxx"));});
test("modal uses configured fields and rejects more than five",()=>{const modal=promotionModal(rank,"token").toJSON();assert.equal(modal.custom_id,"promo:submit:token");assert.equal(modal.components.length,1);assert.throws(()=>promotionModal({...rank,questions:Array(6).fill(rank.questions[0])},"x"));});
test("promotion panel explains how to apply without showing technical markers",()=>{const text=JSON.stringify(promotionPanel({family:"MEMPHIS",title:"Configured title",description:"Configured desc",isEnabled:true,discordChannelId:null,discordMessageId:null,publishedChannelId:null},"https://londo.example/promotions/apply"));for(const value of ["Configured title","Configured desc","Как подать заявку","требованиям","Подать заявку","https://londo.example/promotions/apply"])assert.ok(text.includes(value));assert.ok(!text.includes("promotion-panel:MEMPHIS"));assert.ok(!text.includes("promo:family"));});
const plan={discordUserId:"user",family:"MEMPHIS" as const,targetRoleId:"target",removeRoleIds:["old1","old2"]};
test("approve grants before removals, preserves unrelated roles and is retry-idempotent",async()=>{const held=new Set(["old1","old2","staff","decorative","phoenix","fam"]),events:string[]=[];const ops={has:async(id:string)=>held.has(id),add:async(id:string)=>{events.push("add:"+id);held.add(id);},remove:async(id:string)=>{events.push("remove:"+id);held.delete(id);}};assert.equal(await applyRolePlan(plan,ops),"APPLIED");assert.equal(events[0],"add:target");assert.deepEqual([...held].sort(),["decorative","fam","phoenix","staff","target"]);assert.equal(await applyRolePlan(plan,ops),"APPLIED");assert.equal(events.length,3);});
test("failed grant preserves originals; partial cleanup stays queued with target granted",async()=>{for(const stage of ["grant","remove"]){const held=new Set(["old1","old2"]);let failed=false;const outcome=await applyRolePlan(plan,{has:async id=>held.has(id),add:async id=>{if(stage==="grant"&&id==="target")throw Error("fail");held.add(id);},remove:async id=>{if(stage==="remove"&&id==="old2"&&!failed){failed=true;throw Error("fail");}held.delete(id);}});assert.equal(outcome,"RETRY");assert.deepEqual([...held].sort(),stage==="grant"?["old1","old2"]:["old2","target"]);}});
test("failed cleanup stays recoverable instead of approved",async()=>{const held=new Set(["old1","old2"]);const outcome=await applyRolePlan(plan,{has:async id=>held.has(id),add:async id=>{if(id==="old1")throw Error("offline");held.add(id);},remove:async id=>{if(id==="old2")throw Error("offline");held.delete(id);}});assert.equal(outcome,"RETRY");assert.ok(held.has("target"));});
test("membership/staff roles are protected against removal; unsafe roles excluded",()=>{const ids=protectedPromotionRoles({fam:"fam",memphis:"m",phoenix:"p"},{staffRoleIds:{MEMPHIS:["staffm"],PHOENIX:["staffp"]}});for(const id of ["fam","m","p","staffm","staffp"])assert.ok(ids.has(id));const role={id:"safe",managed:false,editable:true,tags:null};assert.equal(safePromotionRole(role,"guild",ids),true);for(const patch of [{id:"guild"},{id:"fam"},{managed:true},{editable:false},{tags:{botId:"x"}},{tags:{integrationId:"x"}}])assert.equal(safePromotionRole({...role,...patch},"guild",ids),false);});
test("dynamic roster mapping keeps separate family ranks and ignores positions",()=>{setPromotionRanks([rank,{...rank,id:"p",family:"PHOENIX",discordRoleId:"phoenix"},{...rank,id:"staff",isPosition:true,sortOrder:100}]);assert.equal(resolvePromotionRank(()=>true,"MEMPHIS")?.roleId,"target");assert.equal(resolvePromotionRank(()=>true,"PHOENIX")?.roleId,"phoenix");setPromotionRanks([]);});

const config={staffRoleIds:{MEMPHIS:["staffm"],PHOENIX:["staffp"]}} as ApplicationConfig;
const families={fam:"fam",memphis:"memphis",phoenix:"phoenix"};
test("panel creates once, edits, recovers missing saved ID and moves to another channel",async()=>{
 const stateDirectory=await mkdtemp(join(tmpdir(),"londo-promotion-panel-test-"));
 try{
 const settings={family:"MEMPHIS" as const,title:"Title",description:"Desc",isEnabled:true,discordChannelId:"channel1",discordMessageId:null as string|null,publishedChannelId:null as string|null};let sends=0,edits=0,deletes=0;
 type Message={id:string;author:{id:string};components:unknown[];edit:(p:{components:unknown[]})=>Promise<void>;delete:()=>Promise<void>};
 function channel(id:string){const messages=new Collection<string,Message>();return {id,type:ChannelType.GuildText,messages:{fetch:async(input:unknown)=>typeof input==="string"?messages.get(input):messages},send:async(payload:{components:unknown[]})=>{const message:Message={id:"message"+(++sends),author:{id:"bot"},components:payload.components,edit:async p=>{edits++;message.components=p.components;},delete:async()=>{deletes++;messages.delete(message.id);}};messages.set(message.id,message);return message;}};}
 const one=channel("channel1"),two=channel("channel2"),guild={id:"guild",client:{user:{id:"bot"}},channels:{fetch:async(id:string)=>id==="channel1"?one:two}} as unknown as Guild;
 class Manager extends PromotionsManager{override async request<T>(body:object):Promise<T>{const b=body as {operation:string;messageId:string;channelId:string};if(b.operation==="PANEL"){settings.discordMessageId=b.messageId;settings.publishedChannelId=b.channelId;return {ok:true} as T;}return {settings:[{...settings}],ranks:[],queue:[]} as T;}}
 const manager=new Manager(guild,{siteUrl:"http://invalid",apiSecret:"test"},families,config,join(stateDirectory,"messages.json"));await Promise.all([manager.refresh("MEMPHIS"),manager.refresh("MEMPHIS")]);assert.equal(sends,1);assert.equal(edits,1);settings.discordMessageId=null;await manager.refresh("MEMPHIS");assert.equal(sends,1);settings.discordChannelId="channel2";await manager.refresh("MEMPHIS");assert.equal(sends,2);assert.equal(deletes,1);assert.equal(settings.publishedChannelId,"channel2");
 }finally{await rm(stateDirectory,{recursive:true,force:true});}
});
test("legacy promotion interactions direct applicants to the site without exposing technical markers",async()=>{
 const guild={} as Guild;const replies:unknown[]=[];
 const manager=new PromotionsManager(guild,{siteUrl:"http://invalid",apiSecret:"test"},families,config);
 function interaction(customId:string){const i={customId,isChatInputCommand:()=>false,isRepliable:()=>true,deferred:false,replied:false,reply:async(v:unknown)=>{replies.push(v);}};return i as unknown as Interaction;}
 for(const customId of ["promo:family","promo:rank","promo:apply:token","promo:submit:token"]){
  await manager.handleInteraction(interaction(customId));
  const response=JSON.stringify(replies.at(-1));
  assert.match(response,/Подача заявок на повышение перенесена на сайт/);
  assert.match(response,/http:\/\/invalid\/promotions\/apply/);
  assert.doesNotMatch(response,/rank1|promo:family/);
 }
});
