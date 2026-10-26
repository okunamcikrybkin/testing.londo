import { prisma } from "@/lib/db/prisma";
import { shopBot, type DiscordOptions } from "@/lib/shop/bot";
import { object, str, snowflake } from "@/lib/promotions/validation";
import { panelInput } from "./validation";
const include={buttons:{orderBy:[{sortOrder:"asc" as const},{id:"asc" as const}]}};
export async function catalog(){return prisma.factionRolePanelSettings.upsert({where:{id:"default"},update:{},create:{id:"default",buttons:{create:["LSPD","LSCSD","FIB","EMS","SANG"].map((name,sortOrder)=>({name,sortOrder}))}},include});}
export function options(){return shopBot<DiscordOptions>("/internal/discord/faction-roles/options",{});}
export async function publish(actorDiscordId:string){return shopBot("/internal/discord/faction-roles/publish",{actorDiscordId});}
export async function save(value:unknown,actorId:string){
 const input=panelInput(value),available=await options();
 if(input.channelId&&!available.channels.some(c=>c.id===input.channelId))throw Error("Канал недоступен bot.");
 for(const b of input.buttons)if(b.discordRoleId&&!available.roles.some(r=>r.id===b.discordRoleId))throw Error("Роль недоступна bot: "+b.name);
 await catalog();
 const panel=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "faction_role_panel_settings" WHERE "id"='default' FOR UPDATE`;
  const prior=await tx.factionRolePanelSettings.findUniqueOrThrow({where:{id:"default"}});
  if(prior.version!==input.version)throw Error("Настройки изменились. Обновите страницу.");
  const {buttons,version,...fields}=input;
  await tx.factionRoleButton.deleteMany({where:{panelId:"default",id:{notIn:buttons.map(b=>b.id)}}});
  for(const b of buttons){const {id,...data}=b;await tx.factionRoleButton.upsert({where:{id},create:{id,panelId:"default",...data},update:data});}
  const updated=await tx.factionRolePanelSettings.update({where:{id:"default"},data:{...fields,version:version+1},include});
  await tx.auditLog.create({data:{actorId,action:"FACTION_ROLE_SETTINGS_UPDATED",targetType:"FactionRolePanel",targetId:"default"}});
  return updated;
 });
 return panel;
}
export async function claim(value:unknown){
 const b=object(value),id=snowflake(b.interactionId),discordUserId=snowflake(b.discordUserId),buttonId=str(b.buttonId,64,1),roleId=snowflake(b.roleId);
 if(typeof b.owned!=="boolean")throw Error("Некорректное состояние роли.");
 const owned=b.owned, clickedAt=new Date(Number((BigInt(id)>>BigInt(22))+BigInt(1420070400000)));
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "faction_role_panel_settings" WHERE "id"='default' FOR UPDATE`;
  const panel=await tx.factionRolePanelSettings.findUniqueOrThrow({where:{id:"default"},include});
  const button=panel.buttons.find(item=>item.id===buttonId&&item.enabled&&item.discordRoleId===roleId);
  if(!button||panel.messageId!==b.messageId||panel.publishedChannelId!==b.channelId)throw Error("Эта кнопка больше недоступна.");
  const exact=await tx.factionRoleOperation.findUnique({where:{id}});
  if(exact){if(exact.discordUserId!==discordUserId||exact.buttonId!==buttonId||exact.roleId!==roleId)throw Error("Некорректный повтор.");return exact;}
  const prior=await tx.factionRoleOperation.findFirst({where:{discordUserId,buttonId,roleId,OR:[{completedAt:null},{createdAt:{gte:new Date(clickedAt.valueOf()-2500),lte:new Date(clickedAt.valueOf()+2500)}}]},orderBy:{createdAt:"desc"}});
  if(prior)return prior;
  return tx.factionRoleOperation.create({data:{id,discordUserId,buttonId,roleId,name:button.name,granted:!owned,createdAt:clickedAt}});
 });
}
export async function complete(value:unknown){const b=object(value),id=snowflake(b.id);return prisma.$transaction(async tx=>{
 const op=await tx.factionRoleOperation.findUniqueOrThrow({where:{id}});
 const updated=await tx.factionRoleOperation.updateMany({where:{id,completedAt:null},data:{completedAt:new Date()}});
 if(updated.count)await tx.auditLog.create({data:{action:op.granted?"FACTION_ROLE_GRANTED":"FACTION_ROLE_REMOVED",targetType:"FactionRoleOperation",targetId:id,metadata:{discordUserId:op.discordUserId,roleId:op.roleId,faction:op.name,timestamp:new Date().toISOString()}}});
 return {ok:true};
});}
export async function recordPanel(value:unknown){const b=object(value),messageId=snowflake(b.messageId),channelId=snowflake(b.channelId),actorDiscordId=snowflake(b.actorDiscordId);return prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT "id" FROM "faction_role_panel_settings" WHERE "id"='default' FOR UPDATE`;
 const prior=await tx.factionRolePanelSettings.findUniqueOrThrow({where:{id:"default"}});
 if(prior.version!==b.version||prior.channelId!==channelId||prior.messageId!==b.previousMessageId)throw Error("Настройки изменились. Повторите обновление панели.");
 await tx.factionRolePanelSettings.update({where:{id:"default"},data:{messageId,publishedChannelId:channelId}});
 await tx.auditLog.create({data:{action:prior.messageId?"FACTION_ROLE_PANEL_UPDATED":"FACTION_ROLE_PANEL_PUBLISHED",targetType:"FactionRolePanel",targetId:"default",metadata:{discordUserId:actorDiscordId,channelId,messageId,timestamp:new Date().toISOString()}}});
 return {ok:true};
});}
