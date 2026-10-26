import { ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,DiscordAPIError,ContainerBuilder,SectionBuilder,SeparatorBuilder,TextDisplayBuilder,EmbedBuilder,MessageFlags,ModalBuilder,PermissionFlagsBits,StringSelectMenuBuilder,TextInputBuilder,TextInputStyle,type Guild,type GuildMember,type Interaction,type TextChannel } from "discord.js";
import type { Family,FamilyRoleIds } from "../types/family.js";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { getMemberFamilies } from "./members.js";
import { logWarning } from "../utils/logger.js";
export function afkRoleId(family:Family){const value=(process.env[family+"_AFK_ROLE_ID"]||process.env.FAMILY_AFK_ROLE_ID||"1545123264655794259").trim();if(!/^\d{17,20}$/.test(value))throw Error("AFK_ROLE_NOT_CONFIGURED");return value;}
export function afkPanel() {
  const container = new ContainerBuilder().setAccentColor(0x2dd4bf)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Отпуск\n> Здесь можно оформить отпуск с указанием причины и даты окончания."))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("**Кнопки:**\n• Уйти в отпуск — откроется форма с причиной и сроком отпуска\n• Список отпусков — покажет активные отпуска\n• Вернуться из отпуска — завершить отпуск досрочно\n\n**Форматы даты окончания:**\n• HH:MM DD.MM.YYYY\n• HH:MM DD.MM\n• HH:MM\n• 10m, 2h, 3d\n\nВремя: Москва (МСК). Максимум — 7 дней.\nОтпуск начинается только после одобрения сотрудником семьи."))
    .addSeparatorComponents(new SeparatorBuilder());
  for (const [text, label, id, style] of [
    ["Оформить отпуск", "Уйти в отпуск", "afk:apply", ButtonStyle.Primary],
    ["Посмотреть активные отпуска", "Список отпусков", "afk:list", ButtonStyle.Secondary],
    ["Вернуться из отпуска раньше срока", "Вернуться из отпуска", "afk:exit", ButtonStyle.Secondary],
  ] as const) container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text)).setButtonAccessory(new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style)));
  return { components: [container], flags: MessageFlags.IsComponentsV2 as const, allowedMentions: { parse: [] as [] } };
}
export function afkModal(family: Family) {
  return new ModalBuilder().setCustomId("afk:submit:" + family).setTitle("Заявка на отпуск").addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Причина").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("duration").setLabel("Срок / дата окончания (Москва, МСК)").setPlaceholder("18:30 06.09.2026 / 18:30 / 10m / 2h").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)),
  );
}
/** Recognize both the existing embed and its V2 replacement without changing button IDs. */
export async function publishVacationPanel(channel: Pick<TextChannel, "messages" | "send">, botId: string) {
  const messages = await channel.messages.fetch({limit: 100});
  const owned = messages.filter(message => message.author.id === botId);
  const current = owned.find(message => JSON.stringify(message.components).includes('"afk:apply"'))
    ?? owned.find(message => message.embeds.some(embed => embed.footer?.text === "londo-afk-approval"));
  const panel = afkPanel();
  if (!current) { await channel.send(panel); return; }
  try { await current.edit({ ...panel, content: null, embeds: [] }); }
  catch (error) {
    if (!(error instanceof DiscordAPIError) || error.code !== 50035 || current.flags.has(MessageFlags.IsComponentsV2)) throw error;
    // Some legacy messages reject V2 conversion. Send first so a failed send preserves the old panel.
    const replacement = await channel.send(panel);
    try { await current.delete(); }
    catch { await replacement.delete().catch(() => undefined); throw Error("Не удалось заменить старую панель отпусков. Проверьте права bot."); }
  }
}
export async function checkAfkRole(guild:Guild,roles:FamilyRoleIds,user:string,family:Family){try{const roleId=afkRoleId(family);if(Object.values(roles).includes(roleId))return {code:"ROLE_UNAVAILABLE"};const [member,role,me]=await Promise.all([guild.members.fetch({user,force:true}),guild.roles.fetch(roleId),guild.members.fetchMe()]);if(!getMemberFamilies(member,roles).includes(family))return {code:"WRONG_FAMILY"};if(!role||role.managed||role.id===guild.id||!role.editable||!me.permissions.has(PermissionFlagsBits.ManageRoles)||role.comparePositionTo(me.roles.highest)>=0)return {code:"ROLE_UNAVAILABLE"};return {code:"OK",roleId};}catch{return {code:"ROLE_UNAVAILABLE"};}}
type Sync={discordUserId:string;desired:string[];known:string[];grants:{family:Family;roleId:string}[]};
export async function syncAfkRoles(guild:Guild,roles:FamilyRoleIds,b:Sync){if(!b||!/^\d{17,20}$/.test(b.discordUserId)||!Array.isArray(b.desired)||!Array.isArray(b.known)||!Array.isArray(b.grants)||b.known.length>4||b.desired.length>2)throw Error("INVALID_INPUT");const allowed=new Set<string>();for(const f of ["MEMPHIS","PHOENIX"] as const){try{allowed.add(afkRoleId(f));}catch{/* unconfigured family */}}if([...b.known,...b.desired].some(id=>!allowed.has(id)||Object.values(roles).includes(id))||b.desired.some(id=>!b.known.includes(id)))throw Error("INVALID_ROLE");let member;try{member=await guild.members.fetch({user:b.discordUserId,force:true});}catch(e){if(e instanceof DiscordAPIError&&e.code===10007)return {code:b.desired.length?"GRANT_FAILED":"OK"};throw e;}
 for(const g of b.grants){if(!["MEMPHIS","PHOENIX"].includes(g.family)||afkRoleId(g.family)!==g.roleId)return {code:"GRANT_FAILED"};if((await checkAfkRole(guild,roles,b.discordUserId,g.family)).code!=="OK")return {code:"GRANT_FAILED"};}
 const original=new Set(member.roles.cache.keys());const added:string[]=[];
 try{for(const id of b.desired)if(!member.roles.cache.has(id)){await member.roles.add(id,"LONDO: отпуск одобрен");added.push(id);}}catch{
  // Re-read after a timeout: REST may have granted a role even if the response was lost.
  const fresh=await guild.members.fetch({user:b.discordUserId,force:true});for(const id of b.desired)if(!original.has(id)&&fresh.roles.cache.has(id)&&!added.includes(id))added.push(id);
  for(const id of added)await fresh.roles.remove(id,"LONDO: отмена выдачи роли отпуска");return {code:"GRANT_FAILED"};
 }
 for(const id of b.known)if(!b.desired.includes(id)&&member.roles.cache.has(id))await member.roles.remove(id,"LONDO: отпуск завершён");return {code:"OK"};
}
type AfkNotification={type:"APPROVED"|"REJECTED"|"ENDED"|"ENDED_EARLY";discordUserId:string;family:Family;requestedStartAt:string;requestedEndAt:string;startedAt?:string|null;endedAt?:string|null;reviewerId?:string|null;endedById?:string|null;reason?:string|null};
function discordTime(value:string|null|undefined){return value?`<t:${Math.floor(new Date(value).getTime()/1000)}:f>`:"Не указано";}
function familyLabel(family:Family){return family==="MEMPHIS"?"Memphis":"Phoenix";}
function durationLabel(start:string,end:string){const minutes=Math.max(0,Math.round((new Date(end).getTime()-new Date(start).getTime())/60000));const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;return [days?`${days} дн.`:"",hours?`${hours} ч.`:"",rest?`${rest} мин.`:""].filter(Boolean).join(" ")||"меньше минуты";}
export async function notifyAfkApplicant(guild:Guild,event:AfkNotification):Promise<{ok:true}|{ok:false}>{try{const user=await guild.client.users.fetch(event.discordUserId);const reviewer=event.reviewerId?`<@${event.reviewerId}>`:`Не указан`;const endedBy=event.endedById?`<@${event.endedById}>`:"Автоматически по окончании срока";const color=event.type==="REJECTED"?0xef4444:event.type==="APPROVED"?0xe6b77a:event.type==="ENDED_EARLY"?0xf59e0b:0x64748b;const title=event.type==="REJECTED"?"Отпуск отклонён":event.type==="APPROVED"?"Отпуск одобрен":event.type==="ENDED_EARLY"?"Отпуск завершён досрочно":"Отпуск завершён";const description=event.type==="REJECTED"?"Ваша заявка на отпуск была отклонена.":event.type==="APPROVED"?"Ваша заявка на отпуск одобрена. Отпуск оформлен.":event.type==="ENDED_EARLY"?"Ваш отпуск был завершён до окончания указанного срока.":"Ваш отпуск завершён по окончании указанного срока.";const embed=new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).addFields({name:"Участник",value:`<@${event.discordUserId}>`,inline:true},{name:"Семья",value:familyLabel(event.family),inline:true},{name:"Период",value:`${discordTime(event.requestedStartAt)} — ${discordTime(event.requestedEndAt)}`},{name:"Продолжительность",value:durationLabel(event.requestedStartAt,event.requestedEndAt),inline:true});if(event.type==="APPROVED")embed.addFields({name:"Одобрил",value:reviewer,inline:true},{name:"Начало отпуска",value:discordTime(event.startedAt),inline:true});if(event.type==="REJECTED")embed.addFields({name:"Рассмотрел",value:reviewer,inline:true},{name:"Причина отказа",value:(event.reason?.trim()||"Причина не указана").slice(0,1024)});if(event.type==="ENDED"||event.type==="ENDED_EARLY")embed.addFields({name:"Завершил",value:endedBy,inline:true},{name:"Время завершения",value:discordTime(event.endedAt),inline:true});embed.setFooter({text:"LONDO • Уведомление об отпуске"}).setTimestamp();await user.send({embeds:[embed]});return {ok:true};}catch{return {ok:false};}}
type View={families:Family[];ownFamilies?:Family[];active:{discordUserId:string;family:Family;endAt:string;identity:{displayName:string;gameNickname:string|null}}[]};
export class AfkManager {
 private timer:NodeJS.Timeout|null=null;private running=false;
 constructor(private guild:Guild,private config:SiteLogConfig,private familyRoles?:FamilyRoleIds){}
 async request<T>(body:object):Promise<T>{const response=await fetch(new URL("/api/internal/afk",this.config.siteUrl),{method:"POST",headers:{"content-type":"application/json","x-londo-bot-secret":this.config.apiSecret},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});const data=await response.json() as T&{message?:string};if(!response.ok)throw Error(data.message||"Система отпусков недоступна.");return data;}
 start(){void this.tick();this.timer=setInterval(()=>void this.tick(),60000);this.timer.unref();}stop(){if(this.timer)clearInterval(this.timer);}
 async tick(){if(this.running)return;this.running=true;try{await this.request({operation:"TICK"});}catch{logWarning("[AFK] Recovery will retry.");}finally{this.running=false;}}
 async handleInteraction(i:Interaction){
  if(i.isChatInputCommand()&&i.commandName==="setup-afk"){if(!i.memberPermissions?.has(PermissionFlagsBits.Administrator)){await i.reply({content:"Только для администраторов.",flags:MessageFlags.Ephemeral});return true;}await i.deferReply({flags:MessageFlags.Ephemeral});const channel=i.channel;if(channel?.type!==ChannelType.GuildText){await i.editReply("Выберите текстовый канал.");return true;}await publishVacationPanel(channel,this.guild.client.user.id);await i.editReply("Панель отпусков опубликована.");return true;}
  if(!(i.isButton()||i.isStringSelectMenu()||i.isModalSubmit())||!i.customId.startsWith("afk:"))return false;
  try{if(i.guildId!==this.guild.id)throw Error("Неверный сервер.");
   if(i.isModalSubmit()){await i.deferReply({flags:MessageFlags.Ephemeral});const family=i.customId.split(":")[2];const result=await this.request<{message:string}>({operation:"SUBMIT",discordUserId:i.user.id,family,duration:i.fields.getTextInputValue("duration"),reason:i.fields.getTextInputValue("reason"),requestKey:i.id});await i.editReply(result.message);return true;}
   if(i.isStringSelectMenu()&&i.customId==="afk:choose:apply"){const family=i.values[0];if(family!=="MEMPHIS"&&family!=="PHOENIX")throw Error("Неверная семья.");await i.showModal(afkModal(family));return true;}
   if(i.isButton()&&i.customId==="afk:apply"){
    const roleFamilies=this.familyRoles&&i.member&&"roles" in i.member&&"cache" in i.member.roles?getMemberFamilies(i.member as GuildMember,this.familyRoles):[];if(roleFamilies.length===1){await i.showModal(afkModal(roleFamilies[0]));return true;}
    // A modal cannot follow a deferred reply. A fresh DB-validated family selector is the first response.
    await i.deferReply({flags:MessageFlags.Ephemeral});const view=await this.request<View>({operation:"VIEW",discordUserId:i.user.id});if(!view.families.length){await i.editReply("Нет активного членства в семье.");return true;}await i.editReply({content:view.families.length===1?"Открыть форму для вашей семьи:":"Выберите сервер для заявки:",components:[new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId("afk:choose:apply").setPlaceholder("Выберите сервер").addOptions(view.families.map(f=>({label:f,value:f}))))]});return true;}
   await i.deferReply({flags:MessageFlags.Ephemeral});
   if(i.isStringSelectMenu()&&i.customId==="afk:choose:exit"){const result=await this.request<{message:string}>({operation:"END",discordUserId:i.user.id,family:i.values[0]});await i.editReply(result.message);return true;}
   const view=await this.request<View>({operation:"VIEW",discordUserId:i.user.id});
   if(i.customId==="afk:list"){const rows=view.active.map(s=>s.identity.displayName.replace(/[@*_~\x60]/g,"")+" · "+s.family+" · до <t:"+Math.floor(new Date(s.endAt).getTime()/1000)+":f>");let chunk="Активные отпуска:\n";for(const row of rows){if(chunk.length+row.length>1800){await i.followUp({content:chunk,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});chunk="";}chunk+=row+"\n";}await i.editReply({content:rows.length?chunk:"Активных отпусков нет.",allowedMentions:{parse:[]}});return true;}
   const families=view.ownFamilies||[...new Set(view.active.filter(s=>s.discordUserId===i.user.id).map(s=>s.family))];if(!families.length){await i.editReply("У вас нет активного отпуска.");return true;}if(families.length===1){const result=await this.request<{message:string}>({operation:"END",discordUserId:i.user.id,family:families[0]});await i.editReply(result.message);}else await i.editReply({content:"Какой отпуск завершить?",components:[new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId("afk:choose:exit").addOptions(families.map(f=>({label:f,value:f}))))]});
  }catch(e){const content=e instanceof Error?e.message:"Система отпусков временно недоступна.";if(i.deferred||i.replied)await i.editReply({content,components:[]});else await i.reply({content,flags:MessageFlags.Ephemeral});}return true;
 }
}
