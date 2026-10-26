import test from "node:test";
import assert from "node:assert/strict";
import { Collection, ChannelType, DiscordAPIError, type Guild, type Interaction } from "discord.js";
import { FactionRolesManager, factionPanelMessage, activeFactionButtons, setFactionRole, type FactionPanel } from "./factionRoles.js";
const base:FactionPanel={id:"default",title:"Выдача ролей фракции",description:"Нажми на кнопку",channelId:"channel",publishedChannelId:"channel",messageId:"message",version:1,buttons:[{id:"lspd",name:"LSPD",discordRoleId:"role",enabled:true,sortOrder:0}]};
test("V2 panel hides disabled/unconfigured factions, sorts buttons, forbids mentions",()=>{
 const panel={...base,buttons:[...base.buttons,{...base.buttons[0],id:"ems",name:"EMS",sortOrder:-1},{...base.buttons[0],id:"off",enabled:false},{...base.buttons[0],id:"unset",discordRoleId:null}]};
 assert.deepEqual(activeFactionButtons(panel).map(b=>b.id),["ems","lspd"]);
 const payload=factionPanelMessage(panel),json=JSON.stringify(payload);assert.ok(json.includes("faction:ems"));assert.ok(!json.includes("faction:off"));assert.ok(!json.includes("faction:unset"));assert.deepEqual(payload.allowedMentions,{parse:[]});
});
test("desired role state is idempotent and failed change is not confirmed",async()=>{
 let held=false,adds=0,removes=0;const ops={has:async()=>held,add:async()=>{adds++;held=true;},remove:async()=>{removes++;held=false;}};
 await setFactionRole(true,ops);await setFactionRole(true,ops);assert.equal(adds,1);
 await setFactionRole(false,ops);await setFactionRole(false,ops);assert.equal(removes,1);
 await assert.rejects(setFactionRole(true,{...ops,add:async()=>{}}));
});
function fixture(){
 const panel=structuredClone(base),held=new Collection<string,unknown>(),replies:unknown[]=[];let adds=0,removes=0,logs=0,claims=0;
 let operation:{id:string;roleId:string;name:string;granted:boolean;completedAt:string|null}|null=null;
 let role:{id:string;managed:boolean;editable:boolean;tags:null|{botId?:string;integrationId?:string};comparePositionTo:()=>number}|null={id:"role",managed:false,editable:true,tags:null,comparePositionTo:()=>-1};
 let permissions=true;
 const member={id:"user",roles:{cache:held,add:async(id:string)=>{adds++;held.set(id,{});},remove:async(id:string)=>{removes++;held.delete(id);}}};
 const guild={id:"guild",client:{user:{id:"bot"}},members:{fetch:async()=>member,fetchMe:async()=>({roles:{highest:{}},permissions:{has:()=>permissions}})},roles:{fetch:async()=>role}} as unknown as Guild;
 class Manager extends FactionRolesManager{override async request<T>(body:object):Promise<T>{const b=body as Record<string,unknown>;if(b.operation==="CATALOG")return panel as T;if(b.operation==="CLAIM"){claims++;operation??={id:String(b.interactionId),roleId:"role",name:"LSPD",granted:!b.owned,completedAt:null};return {...operation} as T;}if(b.operation==="COMPLETE"){if(operation&&!operation.completedAt){operation.completedAt="done";logs++;}return {ok:true} as T;}throw Error("unexpected");}}
 const manager=new Manager(guild,{siteUrl:"http://invalid",apiSecret:"test"});
 function interaction(id="1",customId="faction:lspd"){return {id,customId,guildId:"guild",channelId:"channel",user:{id:"user"},message:{id:"message",author:{id:"bot"}},isButton:()=>true,deferReply:async()=>{},editReply:async(v:unknown)=>{replies.push(v);}} as unknown as Interaction;}
 return {panel,held,replies,manager,interaction,nextClick:()=>{operation=null;},setRole:(r:typeof role)=>{role=r;},getRole:()=>role!,setPermissions:(p:boolean)=>{permissions=p;},counts:()=>({adds,removes,logs,claims})};
}
test("grant then deliberate next click removes; rapid clicks share one operation",async()=>{
 const f=fixture();await Promise.all([f.manager.handleInteraction(f.interaction("1")),f.manager.handleInteraction(f.interaction("2"))]);
 assert.equal(f.held.has("role"),true);assert.equal(f.counts().adds,1);assert.equal(f.counts().logs,1);assert.match(JSON.stringify(f.replies),/успешно выдана/);
 f.nextClick();await f.manager.handleInteraction(f.interaction("3"));assert.equal(f.held.has("role"),false);assert.equal(f.counts().removes,1);assert.match(JSON.stringify(f.replies.at(-1)),/успешно снята/);
});
for(const problem of ["disabled","unknown button","forged ID","unknown role","managed","bot role","integration role","hierarchy","uneditable","permission"]){test(problem+" denies role mutation",async()=>{
 const f=fixture();let customId="faction:lspd";
 if(problem==="disabled")f.panel.buttons[0].enabled=false;
 if(problem==="unknown button")customId="faction:unknown";
 if(problem==="forged ID")customId="faction:lspd:arbitrary-role";
 if(problem==="unknown role")f.setRole(null);
 if(problem==="managed")f.getRole().managed=true;
 if(problem==="bot role")f.getRole().tags={botId:"bot"};
 if(problem==="integration role")f.getRole().tags={integrationId:"integration"};
 if(problem==="hierarchy")f.getRole().comparePositionTo=()=>1;
 if(problem==="uneditable")f.getRole().editable=false;
 if(problem==="permission")f.setPermissions(false);
 await f.manager.handleInteraction(f.interaction("1",customId));assert.equal(f.counts().adds,0);assert.equal(f.counts().removes,0);assert.equal(f.counts().claims,0);
 });}
test("publish creates once, updates existing panel, recovers missing message and preserves order",async()=>{
 const panel=structuredClone(base);panel.messageId=null;panel.publishedChannelId=null;let sends=0,edits=0;
 type Msg={id:string;author:{id:string};components:unknown[];edit:(p:{components:unknown[]})=>Promise<void>;delete:()=>Promise<void>};
 const messages=new Collection<string,Msg>();
 const channel={id:"channel",type:ChannelType.GuildText,permissionsFor:()=>({has:()=>true}),messages:{fetch:async(input:unknown)=>typeof input==="string"?(messages.get(input)??(()=>{throw new DiscordAPIError({code:10008,message:"Unknown Message"},10008,404,"GET","https://discord.test",{});})()):messages},send:async(p:{components:unknown[]})=>{const m:Msg={id:"message"+(++sends),author:{id:"bot"},components:p.components,edit:async p=>{edits++;m.components=p.components;},delete:async()=>{messages.delete(m.id);}};messages.set(m.id,m);return m;}};
 const guild={id:"guild",client:{user:{id:"bot"}},members:{fetchMe:async()=>({})},channels:{fetch:async()=>channel}} as unknown as Guild;
 class Manager extends FactionRolesManager{override async request<T>(body:object):Promise<T>{const b=body as Record<string,unknown>;if(b.operation==="CATALOG")return {...panel} as T;if(b.operation==="PANEL"){panel.messageId=String(b.messageId);panel.publishedChannelId=String(b.channelId);return {} as T;}throw Error("unexpected");}}
 const manager=new Manager(guild,{siteUrl:"http://invalid",apiSecret:"test"});
 await Promise.all([manager.publish("actor"),manager.publish("actor")]);assert.equal(sends,1);assert.equal(edits,1);
 panel.buttons[0].enabled=false;await manager.publish("actor");assert.ok(!JSON.stringify(messages.first()!.components).includes("faction:lspd"));
 messages.clear();await manager.publish("actor");assert.equal(sends,2);assert.equal(panel.messageId,"message2");
 panel.messageId=null;await manager.publish("actor");assert.equal(sends,2);
});
