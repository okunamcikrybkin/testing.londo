import { mainRankCleanup, MAIN_RANK_ROLE_IDS } from "./main-ranks.js";
import { assertPromotionRoleAllowed, filterPromotionRoles } from "./role-allowlist.js";
import {randomUUID} from "node:crypto";
import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,ContainerBuilder,DiscordAPIError,EmbedBuilder,escapeMarkdown,MessageFlags,ModalBuilder,PermissionFlagsBits,StringSelectMenuBuilder,TextDisplayBuilder,TextInputBuilder,TextInputStyle,type Guild,type Interaction,type Role} from "discord.js";
import type {SiteLogConfig} from "../config/siteLogs.js";
import type {ApplicationConfig,Family,FamilyRoleIds} from "../types/family.js";
import {FAMILY_RANKS} from "../config/familyRanks.js";
import {getMemberFamilies} from "./members.js";
import {syncRosterMember} from "./memberRosterSync.js";
import {setPromotionRanks} from "./promotionRanks.js";
import {safeShopRole,ShopManager} from "./shop.js";
import {logWarning, describeDiscordError} from "../utils/logger.js";
export type PromotionRank={id:string;family:Family;name:string;description:string|null;discordRoleId:string;sortOrder:number;isActive:boolean;isPosition:boolean;deletedAt?:string|null;version:number;criteria:{text:string;isRequired:boolean;sortOrder:number}[];questions:{id:string;label:string;placeholder:string|null;type:"SHORT"|"PARAGRAPH";required:boolean;minLength:number|null;maxLength:number|null;sortOrder:number}[]};
type Settings={family:Family;title:string;description:string;discordChannelId:string|null;discordMessageId:string|null;publishedChannelId:string|null;isEnabled:boolean};
type Catalog={settings:Settings[];ranks:PromotionRank[];queue:{id:string}[]};
const PANEL_MESSAGE_STATE_FILE=resolve("data/promotion-panels.json");
function isPanelMessageState(value:unknown):value is Record<string,string>{return Boolean(value&&typeof value==="object"&&!Array.isArray(value)&&Object.values(value).every(item=>typeof item==="string"));}
async function readPanelMessageState(path:string):Promise<Record<string,string>>{try{const state:unknown=JSON.parse(await readFile(path,"utf8"));if(!isPanelMessageState(state))throw new Error("Invalid promotion panel message state.");return state;}catch(error){if(error&&typeof error==="object"&&"code" in error&&error.code==="ENOENT")return {};throw error;}}
async function rememberPanelMessage(path:string,key:string,id:string){const state=await readPanelMessageState(path);if(state[key]===id)return;state[key]=id;await mkdir(dirname(path),{recursive:true});await writeFile(`${path}.tmp`,JSON.stringify(state));await rename(`${path}.tmp`,path);}
export type RolePlan={discordUserId:string;family:Family;targetRoleId:string;removeRoleIds:string[]};
export type RoleOperations={has:(id:string)=>Promise<boolean>;add:(id:string)=>Promise<void>;remove:(id:string)=>Promise<void>};
/** Retry the persisted intent until the target is confirmed and old main ranks are absent. */
export async function applyRolePlan(plan:RolePlan,ops:RoleOperations,cleanupRoleIds:readonly string[]=plan.removeRoleIds):Promise<"APPLIED"|"RETRY"> {
 let stage="grant",currentRoleId=plan.targetRoleId;
 try {
  if(!await ops.has(plan.targetRoleId))await ops.add(plan.targetRoleId);
  if(!await ops.has(plan.targetRoleId))throw new Error("Grant not confirmed");
  stage="cleanup";
  for(const roleId of cleanupRoleIds){currentRoleId=roleId;if(roleId!==plan.targetRoleId&&await ops.has(roleId))await ops.remove(roleId);}
  stage="verification";currentRoleId=plan.targetRoleId;
  if(!await ops.has(plan.targetRoleId))throw new Error("Target absent");
  for(const roleId of cleanupRoleIds){currentRoleId=roleId;if(roleId!==plan.targetRoleId&&await ops.has(roleId))throw new Error("Old rank remains");}
  return "APPLIED";
 }catch(error){
  logWarning(`Promotion replacement pending for member ${plan.discordUserId}, stage ${stage}, role ${currentRoleId}: ${describeDiscordError(error)}`);
  // Never undo a confirmed grant or restore obsolete ranks. APPROVING is retried by the queue.
  return "RETRY";
 }
}
export function availableRanks(ranks:PromotionRank[],family:Family){return ranks.filter(r=>r.family===family&&r.isActive&&!r.deletedAt).sort((a,b)=>a.sortOrder-b.sortOrder||a.id.localeCompare(b.id));}
export function protectedPromotionRoles(roles:FamilyRoleIds,config:Pick<ApplicationConfig,"staffRoleIds">){return new Set([roles.fam,roles.memphis,roles.phoenix,...config.staffRoleIds.MEMPHIS,...config.staffRoleIds.PHOENIX,...FAMILY_RANKS.filter(r=>!MAIN_RANK_ROLE_IDS.includes(r.roleId)).map(r=>r.roleId)]);}
export function safePromotionRole(role:Pick<Role,"id"|"managed"|"editable"|"tags">,guildId:string,protectedIds:Set<string>){return safeShopRole(role,guildId)&&!protectedIds.has(role.id);}
export function previewChunks(rank:PromotionRank){const text=[`**${escapeMarkdown(rank.name)}**`,escapeMarkdown(rank.description??""),"Критерии:",...rank.criteria.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(c=>`• ${escapeMarkdown(c.text)}${c.isRequired?" (обязательно)":""}`)].join("\n");const chunks:string[]=[];for(let i=0;i<text.length;i+=1800)chunks.push(text.slice(i,i+1800));return chunks;}
export function promotionModal(rank:PromotionRank,token:string){if(rank.questions.length<1||rank.questions.length>5)throw new Error("Форма недоступна. Обратитесь к администрации.");const modal=new ModalBuilder().setCustomId(`promo:submit:${token}`).setTitle(rank.name.slice(0,45));for(const q of rank.questions.slice().sort((a,b)=>a.sortOrder-b.sortOrder)){const input=new TextInputBuilder().setCustomId(q.id).setLabel(q.label).setStyle(q.type==="SHORT"?TextInputStyle.Short:TextInputStyle.Paragraph).setRequired(q.required).setMaxLength(q.maxLength??4000);if(q.minLength)input.setMinLength(q.minLength);if(q.placeholder)input.setPlaceholder(q.placeholder);modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));}return modal;}
export function promotionPanel(settings:Settings,applyUrl?:string){const family=settings.family==="MEMPHIS"?"Memphis":"Phoenix";const container=new ContainerBuilder().setAccentColor(settings.family==="MEMPHIS"?0x2dd4bf:0xf97316).addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 📈 Продвижение в семье ${family}\n## ${escapeMarkdown(settings.title)}\n${escapeMarkdown(settings.description)}`)).addTextDisplayComponents(new TextDisplayBuilder().setContent(settings.isEnabled?"### Как подать заявку\n1. Открой форму и выбери интересующий ранг.\n2. Ознакомься с требованиями и ответь на вопросы.\n3. Отправь анкету и дождись решения рекрутера.\n\nРешение появится в личных сообщениях Discord.":"Приём заявок на повышение временно закрыт.")).addActionRowComponents(...(applyUrl&&settings.isEnabled?[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel("Подать заявку").setStyle(ButtonStyle.Link).setURL(applyUrl))]:[]));return {components:[container],flags:MessageFlags.IsComponentsV2 as const,allowedMentions:{parse:[] as []}};}
const managers=new Map<string,PromotionsManager>();
export function promotionsManager(guild:Guild,config:SiteLogConfig,roles:FamilyRoleIds,applications:ApplicationConfig){let manager=managers.get(guild.id);if(!manager){manager=new PromotionsManager(guild,config,roles,applications);managers.set(guild.id,manager);}return manager;}
export class PromotionsManager {
 private timer:NodeJS.Timeout|null=null;private polling=false;private locks=new Map<string,Promise<unknown>>();private forms=new Map<string,{userId:string;rank:PromotionRank;expires:number}>();
 constructor(private guild:Guild,private config:SiteLogConfig,private roles:FamilyRoleIds,private applications:ApplicationConfig,private panelMessageStateFile=PANEL_MESSAGE_STATE_FILE){}
 async request<T>(body:object):Promise<T>{const response=await fetch(new URL("/api/internal/promotions",this.config.siteUrl),{method:"POST",headers:{"content-type":"application/json","x-londo-bot-secret":this.config.apiSecret},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});const data=await response.json() as T&{error?:string};if(!response.ok)throw new Error(data.error||"Система повышений временно недоступна.");return data;}
 private async serial<T>(key:string,fn:()=>Promise<T>){const next=(this.locks.get(key)??Promise.resolve()).catch(()=>undefined).then(fn);this.locks.set(key,next);try{return await next;}finally{if(this.locks.get(key)===next)this.locks.delete(key);}}
 async catalog(){const data=await this.request<Catalog>({operation:"CATALOG"});setPromotionRanks(data.ranks);return data;}
 async options(family?:Family){const result=await new ShopManager(this.guild,this.config).options();return {...result,roles:filterPromotionRoles(result.roles,family)};}
 async check(userId:string,roleId:string,family:Family){assertPromotionRoleAllowed(family,roleId);if(!/^\d{17,20}$/.test(userId)||!/^\d{17,20}$/.test(roleId)||!["MEMPHIS","PHOENIX"].includes(family))throw new Error("Недопустимые данные.");const [member,role,me]=await Promise.all([this.guild.members.fetch({user:userId,force:true}),this.guild.roles.fetch(roleId),this.guild.members.fetchMe()]);if(!role||!safePromotionRole(role,this.guild.id,new Set(Object.values(this.roles)))||!me.permissions.has(PermissionFlagsBits.ManageRoles)||role.comparePositionTo(me.roles.highest)>=0)throw new Error("Роль недоступна для выдачи.");const families=getMemberFamilies(member,this.roles);if(!families.includes(family))throw new Error("Вы не состоите в выбранной семье.");const protectedIds=protectedPromotionRoles(this.roles,this.applications);return {removableRoleIds:[...member.roles.cache.keys()].filter(id=>!protectedIds.has(id)),roleIds:[...member.roles.cache.keys()],families,owned:member.roles.cache.has(roleId),username:member.user.username,displayName:member.displayName};}
 async apply(id:string){return this.serial("application:"+id,async()=>{
 const {plan}=await this.request<{plan:RolePlan}>({operation:"PLAN",id});return this.serial("member:"+plan.discordUserId,async()=>{
 let outcome:"APPLIED"|"RETRY"="RETRY";const removedRoleIds=new Set<string>();
 try {const catalog=await this.catalog();const rank=catalog.ranks.find(r=>r.discordRoleId===plan.targetRoleId&&r.family===plan.family&&r.isActive&&!r.deletedAt);if(!rank)throw new Error("Target configuration unavailable");await this.check(plan.discordUserId,plan.targetRoleId,plan.family);const protectedIds=protectedPromotionRoles(this.roles,this.applications);
 const cleanupRoleIds=mainRankCleanup(plan.family,plan.targetRoleId,rank.isPosition,catalog.ranks.filter(r=>r.isPosition).map(r=>r.discordRoleId));
 const validateRemoval=async(roleId:string)=>{const role=await this.guild.roles.fetch(roleId);if(!role||!safePromotionRole(role,this.guild.id,protectedIds))throw new Error("Old rank unavailable");};
 const member=await this.guild.members.fetch({user:plan.discordUserId,force:true});outcome=await applyRolePlan(plan,{has:async roleId=>(await this.guild.members.fetch({user:plan.discordUserId,force:true})).roles.cache.has(roleId),add:async roleId=>{await member.roles.add(roleId,`Promotion ${id}`);},remove:async roleId=>{await validateRemoval(roleId);await member.roles.remove(roleId,`Promotion ${id}`);removedRoleIds.add(roleId);}},cleanupRoleIds);
 }catch(error) {logWarning(`Promotion ${id} pending: ${describeDiscordError(error)}`);}
 const settled=await this.request<{notification?:{discordUserId:string;family:Family;rankName:string;status:"APPROVED";reviewerId:string;reviewerName:string}}>({operation:"SETTLE",id,outcome,removedRoleIds:[...removedRoleIds],error:"Выдача не завершена. Проверьте роли, права bot и членство участника; bot повторит операцию."});
 if(outcome==="APPLIED"){const member=await this.guild.members.fetch({user:plan.discordUserId,force:true});await syncRosterMember(this.config,this.guild.id,member,this.roles);if(settled.notification)await this.notify(settled.notification).catch(()=>logWarning("Promotion result DM could not be delivered."));}
 return {ok:outcome==="APPLIED",outcome};
 });});}
 async notify(value:unknown){
 const v=value as Record<string,unknown>;
 if(typeof v.discordUserId!=="string"||!/^[0-9]{17,20}$/.test(v.discordUserId)||!(v.family==="MEMPHIS"||v.family==="PHOENIX")||typeof v.rankName!=="string"||typeof v.reviewerName!=="string"||typeof v.reviewerId!=="string"||!/^[0-9]{17,20}$/.test(v.reviewerId)||!(v.status==="APPROVED"||v.status==="REJECTED"))throw new Error("Invalid promotion notification.");
 const member=await this.guild.members.fetch({user:v.discordUserId,force:true});
 const approved=v.status==="APPROVED";
 const reviewerMention=`<@${v.reviewerId}>`;
 const embed=new EmbedBuilder()
  .setColor(approved?0x2ecc71:0xc05a5a)
  .setTitle(approved?"Заявка на повышение одобрена":"Заявка на повышение отклонена")
  .setDescription(approved?"Рекрутер рассмотрел вашу заявку и подтвердил повышение.":"Рекрутер рассмотрел вашу заявку и отказал в повышении.")
  .addFields({name:"Семья",value:String(v.family),inline:true},{name:"Ранг",value:escapeMarkdown(v.rankName),inline:true},{name:"Решение принял",value:reviewerMention});
 if(!approved&&typeof v.reason==="string"&&v.reason.trim())embed.addFields({name:"Комментарий",value:escapeMarkdown(v.reason.slice(0,1000))});
 await member.send({embeds:[embed],allowedMentions:{parse:[],users:[v.reviewerId]}});
 return {ok:true};
 }
 async refresh(family?:Family){if(family!==undefined&&family!=="MEMPHIS"&&family!=="PHOENIX")throw new Error("Неизвестная семья.");for(const f of family?[family]:["MEMPHIS","PHOENIX"] as Family[])await this.serial("panel:"+f,async()=>{
 const data=await this.catalog(),settings=data.settings.find(s=>s.family===f);if(!settings?.discordChannelId)return;const channel=await this.guild.channels.fetch(settings.discordChannelId);if(channel?.type!==ChannelType.GuildText)throw new Error("Канал недоступен.");let message=null;
 const stateKey=`${this.guild.id}:${f}:${channel.id}`,savedMessageId=(await readPanelMessageState(this.panelMessageStateFile))[stateKey]??null;
 for(const messageId of [settings.publishedChannelId===channel.id?settings.discordMessageId:null,savedMessageId]){if(!messageId||message)continue;try{message=await channel.messages.fetch(messageId);}catch(e){if(!(e instanceof DiscordAPIError&&Number(e.code)===10008))throw e;}}
 if(message&&message.author.id!==this.guild.client.user.id)throw new Error("Сообщение не принадлежит bot.");
 if(!message){const recent=await channel.messages.fetch({limit:100});message=recent.find(m=>m.author.id===this.guild.client.user.id&&JSON.stringify(m.components).includes(`promotion-panel:${f}`))??null;}
 let created=false;if(message)await message.edit(promotionPanel(settings,new URL("/promotions/apply",this.config.siteUrl).href));else{message=await channel.send(promotionPanel(settings,new URL("/promotions/apply",this.config.siteUrl).href));created=true;}
 try{await this.request({operation:"PANEL",family:f,messageId:message.id,channelId:channel.id,previousMessageId:settings.discordMessageId});}catch(e){if(created){const current=(await this.catalog()).settings.find(s=>s.family===f);if(current?.discordMessageId!==message.id)await message.delete().catch(()=>undefined);}throw e;}
 await rememberPanelMessage(this.panelMessageStateFile,stateKey,message.id);
 if(settings.discordMessageId&&settings.publishedChannelId&&settings.publishedChannelId!==channel.id){const old=await this.guild.channels.fetch(settings.publishedChannelId).catch(()=>null);if(old?.type===ChannelType.GuildText){const previous=await old.messages.fetch(settings.discordMessageId).catch(()=>null);if(previous?.author.id===this.guild.client.user.id)await previous.delete().catch(()=>undefined);}}
 });return {ok:true};}
 start(){if(this.timer)return;this.timer=setInterval(()=>void this.tick(),60000);this.timer.unref();void this.tick();}stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 private async tick(){if(this.polling)return;this.polling=true;try{const data=await this.catalog();for(const {id} of data.queue)await this.apply(id).catch(()=>logWarning("Promotion recovery pending."));for(const [key,value] of this.forms)if(value.expires<Date.now())this.forms.delete(key);}catch{logWarning("Promotion catalog unavailable; will retry.");}finally{this.polling=false;}}
 async handleInteraction(interaction:Interaction):Promise<boolean>{
 if(interaction.isChatInputCommand()&&interaction.commandName==="setup-promotions"){
  try{await interaction.deferReply({flags:MessageFlags.Ephemeral});const allowed=interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)||(await this.request<{allowed:boolean}>({operation:"AUTHORIZE",discordUserId:interaction.user.id})).allowed;if(!allowed)throw new Error("Not authorized.");await this.refresh();await interaction.editReply("Panels refreshed from the site configuration.");}catch(error){const message=error instanceof Error?error.message:"Promotion panel refresh failed.";if(interaction.deferred||interaction.replied)await interaction.editReply({content:message});else await interaction.reply({content:message,flags:MessageFlags.Ephemeral});}return true;
 }
 if(!( "customId" in interaction && interaction.customId.startsWith("promo:")))return false;
 if(!interaction.isRepliable())return true;
 const url=new URL("/promotions/apply",this.config.siteUrl).href;
 await interaction.reply({content:"\u041f\u043e\u0434\u0430\u0447\u0430 \u0437\u0430\u044f\u0432\u043e\u043a \u043d\u0430 \u043f\u043e\u0432\u044b\u0448\u0435\u043d\u0438\u0435 \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0435\u043d\u0430 \u043d\u0430 \u0441\u0430\u0439\u0442. \u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0444\u043e\u0440\u043c\u0443: "+url,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});return true;
 }
}
