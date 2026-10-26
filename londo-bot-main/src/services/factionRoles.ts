import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ContainerBuilder, DiscordAPIError, escapeMarkdown, MessageFlags, PermissionFlagsBits, TextDisplayBuilder, type Guild, type Interaction } from "discord.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { safeShopRole, ShopManager } from "./shop.js";
import { describeDiscordError, logWarning } from "../utils/logger.js";
export type FactionButton={id:string;name:string;discordRoleId:string|null;sortOrder:number;enabled:boolean};
export type FactionPanel={id:string;title:string;description:string;channelId:string|null;messageId:string|null;publishedChannelId:string|null;version:number;buttons:FactionButton[]};
type Operation={id:string;roleId:string;name:string;granted:boolean;completedAt:string|null};
export function activeFactionButtons(panel:FactionPanel){return panel.buttons.filter(b=>b.enabled&&b.discordRoleId).sort((a,b)=>a.sortOrder-b.sortOrder||a.id.localeCompare(b.id));}
export function factionPanelMessage(panel:FactionPanel){
 const container=new ContainerBuilder().setAccentColor(0x2dd4bf).addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${escapeMarkdown(panel.title)}\n${escapeMarkdown(panel.description)}`));
 const buttons=activeFactionButtons(panel);
 if(buttons.length>25)throw Error("Максимум 25 фракций.");
 for(let i=0;i<buttons.length;i+=5)container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i,i+5).map(b=>new ButtonBuilder().setCustomId(`faction:${b.id}`).setLabel(b.name).setStyle(ButtonStyle.Secondary))));
 return {components:[container],flags:MessageFlags.IsComponentsV2 as const,allowedMentions:{parse:[] as []}};
}
export async function setFactionRole(granted:boolean,ops:{has:()=>Promise<boolean>;add:()=>Promise<void>;remove:()=>Promise<void>}){
 if(await ops.has()!==granted){if(granted)await ops.add();else await ops.remove();}
 if(await ops.has()!==granted)throw Error("Discord не подтвердил изменение роли.");
}
const managers=new Map<string,FactionRolesManager>();
export function factionRolesManager(guild:Guild,config:SiteLogConfig){let manager=managers.get(guild.id);if(!manager){manager=new FactionRolesManager(guild,config);managers.set(guild.id,manager);}return manager;}
export class FactionRolesManager {
 private locks=new Map<string,Promise<unknown>>();
 constructor(private guild:Guild,private config:SiteLogConfig){}
 async request<T>(body:object):Promise<T>{const response=await fetch(new URL("/api/internal/faction-roles",this.config.siteUrl),{method:"POST",headers:{"content-type":"application/json","x-londo-bot-secret":this.config.apiSecret},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error("Настройки фракции изменились или сайт недоступен.");return response.json() as Promise<T>;}
 async catalog(){return this.request<FactionPanel>({operation:"CATALOG"});}
 async options(){return new ShopManager(this.guild,this.config).options();}
 private async serial<T>(key:string,fn:()=>Promise<T>){const next=(this.locks.get(key)??Promise.resolve()).catch(()=>undefined).then(fn);this.locks.set(key,next);try{return await next;}finally{if(this.locks.get(key)===next)this.locks.delete(key);}}
 async publish(actorDiscordId:string){return this.serial("panel",async()=>{
  const panel=await this.catalog();if(!panel.channelId)throw Error("Выберите канал панели.");
  const channel=await this.guild.channels.fetch(panel.channelId);const me=await this.guild.members.fetchMe();
  if(channel?.type!==ChannelType.GuildText||!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]))throw Error("Канал недоступен bot.");
  let message=null;
  if(panel.messageId&&panel.publishedChannelId===channel.id)try{message=await channel.messages.fetch(panel.messageId);}catch(error){if(!(error instanceof DiscordAPIError&&Number(error.code)===10008))throw error;}
  if(message&&message.author.id!==this.guild.client.user.id)throw Error("Сообщение не принадлежит bot.");
 if(!message){const recent=await channel.messages.fetch({limit:100});message=recent.find(m=>m.author.id===this.guild.client.user.id&&JSON.stringify(m.components).includes(`## ${panel.title}`))??null;}
  let created=false;if(message)await message.edit(factionPanelMessage(panel));else{message=await channel.send(factionPanelMessage(panel));created=true;}
  try{await this.request({operation:"PANEL",channelId:channel.id,messageId:message.id,previousMessageId:panel.messageId,version:panel.version,actorDiscordId});}catch(error){if(created){const current=await this.catalog().catch(()=>null);if(current&&current.messageId!==message.id)await message.delete().catch(()=>undefined);}throw error;}
 if(panel.messageId&&panel.publishedChannelId&&panel.publishedChannelId!==channel.id){const oldChannel=await this.guild.channels.fetch(panel.publishedChannelId).catch(()=>null);if(oldChannel?.type===ChannelType.GuildText){const old=await oldChannel.messages.fetch(panel.messageId).catch(()=>null);if(old?.author.id===this.guild.client.user.id&&JSON.stringify(old.components).includes(`## ${panel.title}`))await old.delete().catch(()=>logWarning("Old faction panel could not be removed."));}}
  return {ok:true,messageId:message.id};
 });}
 async handleInteraction(interaction:Interaction):Promise<boolean>{
  if(!interaction.isButton()||!interaction.customId.startsWith("faction:"))return false;
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  try{await this.serial("member:"+interaction.user.id,async()=>{
   const match=/^faction:([a-zA-Z0-9_-]{1,64})$/.exec(interaction.customId);if(!match||interaction.guildId!==this.guild.id)throw Error("Неизвестная кнопка фракции.");
   const panel=await this.catalog(),button=activeFactionButtons(panel).find(b=>b.id===match[1]);
   if(!button?.discordRoleId||interaction.message.id!==panel.messageId||interaction.channelId!==panel.publishedChannelId||interaction.message.author.id!==this.guild.client.user.id)throw Error("Эта кнопка больше недоступна.");
   const roleId=button.discordRoleId;
   const role=await this.guild.roles.fetch(roleId),me=await this.guild.members.fetchMe();
   if(!role||!safeShopRole(role,this.guild.id)||!me.permissions.has(PermissionFlagsBits.ManageRoles)||role.comparePositionTo(me.roles.highest)>=0)throw Error("Bot не может управлять этой ролью.");
   const member=await this.guild.members.fetch({user:interaction.user.id,force:true});
   const op=await this.request<Operation>({operation:"CLAIM",interactionId:interaction.id,discordUserId:member.id,buttonId:button.id,roleId,owned:member.roles.cache.has(roleId),messageId:interaction.message.id,channelId:interaction.channelId});
   if(op.roleId!==roleId)throw Error("Настройки фракции изменились.");
   // A completed retry is acknowledged without reversing a newer toggle.
   if(!op.completedAt){
    const fresh=await this.catalog();if(!activeFactionButtons(fresh).some(b=>b.id===button.id&&b.discordRoleId===roleId))throw Error("Настройки фракции изменились.");
    await setFactionRole(op.granted,{has:async()=>(await this.guild.members.fetch({user:member.id,force:true})).roles.cache.has(roleId),add:async()=>{await member.roles.add(roleId,"Faction role "+op.id);},remove:async()=>{await member.roles.remove(roleId,"Faction role "+op.id);}});
    await this.request({operation:"COMPLETE",id:op.id});
   }
   await interaction.editReply({content:`Роль ${escapeMarkdown(op.name)} успешно ${op.granted?"выдана":"снята"}.`,allowedMentions:{parse:[]}});
  });}catch(error){logWarning("Faction role interaction failed: "+describeDiscordError(error));await interaction.editReply({content:"Не удалось изменить роль. Проверьте доступность фракции и попробуйте ещё раз.",allowedMentions:{parse:[]}});}
  return true;
 }
}
