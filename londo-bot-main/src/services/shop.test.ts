import { once } from "node:events";
import test from "node:test";
import assert from "node:assert/strict";
import { ChannelType, Collection, DiscordAPIError, MessageFlags, type Guild, type Role } from "discord.js";
import { buildShopPanel, safeShopRole, ShopManager, type Shop } from "./shop.js";
const shop:Shop={family:"MEMPHIS",title:"Shop",description:"Open",closedText:"Closed text",status:"OPEN",discordChannelId:"channel",discordMessageId:null,items:[{id:"one",name:"A",price:"2000",sortOrder:1,isActive:true},{id:"two",name:"B",price:"1",sortOrder:0,isActive:false}]};
test("Components V2 panel contains active items and buy buttons without technical markers",()=>{const p=buildShopPanel(shop);const json=JSON.stringify(p);assert.equal(p.flags,MessageFlags.IsComponentsV2);assert.match(json,/shop:buy:one/);assert.doesNotMatch(json,/shop:buy:two/);assert.match(json,/Купить/);assert.doesNotMatch(json,/shop-panel:/);});
test("closed panel retains products, uses closedText and disables purchase",()=>{const p=JSON.stringify(buildShopPanel({...shop,status:"CLOSED"}));assert.match(p,/Closed text/);assert.match(p,/"disabled":true/);});
test("large catalog paginates without dropping products",()=>{const catalog={...shop,items:Array.from({length:20},(_,n)=>({id:"item"+n,name:"Item "+n,price:"1",sortOrder:n,isActive:true}))};assert.match(JSON.stringify(buildShopPanel(catalog)),/shop:page:MEMPHIS:1/);assert.match(JSON.stringify(buildShopPanel(catalog,2)),/shop:buy:item19/);});
test("everyone, managed, bot, integration and unassignable roles are excluded",()=>{const role={id:"role",managed:false,editable:true,tags:null} as unknown as Role;assert.equal(safeShopRole(role,"guild"),true);for(const patch of [{id:"guild"},{managed:true},{editable:false},{tags:{botId:"bot"}},{tags:{integrationId:"integration"}}])assert.equal(safeShopRole({...role,...patch} as Role,"guild"),false);});
function fixture(existing=false) {
 let sends=0,edits=0,grants=0;let pending=true;let owned=false;const settlements:boolean[]=[];
 const message={id:"message",author:{id:"bot"},components:[],edit:async()=>{edits++;},delete:async()=>undefined};
 const missing=new DiscordAPIError({code:10008,message:"Unknown Message"},10008,404,"GET","https://discord.test",{});
 const channel={id:"channel",name:"shop",type:ChannelType.GuildText,permissionsFor:()=>({has:()=>true}),messages:{fetch:async(value:unknown)=>typeof value==="object"?new Collection():existing?message:Promise.reject(missing)},send:async()=>{sends++;return message;}};
 const member={roles:{cache:{has:()=>owned},add:async()=>{grants++;owned=true;}}};
 const guild={id:"guild",client:{user:{id:"bot"}},channels:{fetch:async()=>channel,cache:new Collection([["channel",channel],["voice",{...channel,id:"voice",type:ChannelType.GuildVoice}]])},members:{fetch:async()=>member,fetchMe:async()=>({permissions:{has:()=>true},roles:{highest:{}}})},roles:{fetch:async()=>undefined,cache:new Collection()}} as unknown as Guild;
 class Manager extends ShopManager {override async request<T>(body?:object):Promise<T>{const b=body as {operation?:string;refund?:boolean}|undefined;if(b?.operation==="SETTLE"){settlements.push(b.refund!);pending=false;return {} as T;}return {shops:[{...shop,discordMessageId:existing?"message":null}],pending:pending?[{id:"purchase",discordUserId:"user",discordRoleId:"role"}]:[]} as T;}override async roleCheck(){return {code:owned?"ALREADY_OWNED":"OK"};}}
 const manager=new Manager(guild,{siteUrl:"http://localhost",apiSecret:"test"});
 return {manager,member,counts:()=>({sends,edits,grants}),settlements,purchase:{id:"purchase",discordUserId:"user",discordRoleId:"role"},own:()=>{owned=true;}};
}
test("existing panel edits; missing panel creates; parallel refresh serializes",async()=>{const existing=fixture(true);await existing.manager.refresh("MEMPHIS");assert.equal(existing.counts().edits,1);assert.equal(existing.counts().sends,0);const missing=fixture();await missing.manager.refresh("MEMPHIS");assert.equal(missing.counts().sends,1);});
test("options expose only suitable text channels",async()=>{const f=fixture();const options=await f.manager.options();assert.deepEqual(options.channels,[{id:"channel",name:"shop"}]);});
test("successful role grant completes once despite concurrent workers",async()=>{const f=fixture();await Promise.all([f.manager.fulfill(f.purchase),f.manager.fulfill(f.purchase)]);assert.equal(f.counts().grants,1);assert.deepEqual(f.settlements,[false]);});
test("failed grant refunds; recovered already-owned role completes without regrant",async()=>{const failed=fixture();failed.member.roles.add=async()=>{throw Error("Discord grant failed");};await failed.manager.fulfill(failed.purchase);assert.deepEqual(failed.settlements,[true]);const recovered=fixture();recovered.own();await recovered.manager.fulfill(recovered.purchase);assert.equal(recovered.counts().grants,0);assert.deepEqual(recovered.settlements,[false]);});
test("uncertain Discord failure remains pending for retry rather than refunding a possible grant",async()=>{const f=fixture();f.manager.roleCheck=async()=>{throw Error("Network outage");};await assert.rejects(f.manager.fulfill(f.purchase));assert.deepEqual(f.settlements,[]);});

test("shop internal endpoints reject missing and incorrect shared secrets",async()=>{
 const {startApplicationServer}=await import("./applicationServer.js");
 const server=startApplicationServer({} as Guild,{applicationChannelId:"",callCategoryId:"",port:0,staffRoleIds:{MEMPHIS:[],PHOENIX:[]},acceptRoleIds:{MEMPHIS:[],PHOENIX:[]}},{fam:"1",memphis:"2",phoenix:"3"},"test-only-secret");
 await once(server,"listening");const address=server.address();if(!address||typeof address==="string")throw Error("No address");
 try {for(const [method,path] of [["GET","options"],["POST","refresh"],["POST","role-check"]])for(const secret of ["","incorrect"]){const response: Response=await fetch("http://127.0.0.1:"+address.port+"/internal/discord/shop/"+path,{method,headers:{"x-londo-bot-secret":secret},...(method==="POST"?{body:"{}"}:{})});assert.equal(response.status,401);}}
 finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
