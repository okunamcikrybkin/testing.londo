import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, PermissionFlagsBits, TextDisplayBuilder, type ApplicationCommandDataResolvable, type ChatInputCommandInteraction, type Guild, type Interaction } from "discord.js";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { logWarning } from "../utils/logger.js";

const MARKER="londo-application-panel";
const OLD_TITLE="👋 ПУТЬ В СЕМЬЮ НАЧИНАЕТСЯ ЗДЕСЬ!";
const file=resolve("data/application-panel.json");
export function applicationSiteUrl(value=process.env.PUBLIC_SITE_URL):string|null {
 try{const u=new URL(value??"");const localHttp=process.env.NODE_ENV!=="production"&&u.protocol==="http:"&&(u.hostname==="localhost"||u.hostname==="127.0.0.1");if((u.protocol!=="https:"&&!localHttp)||u.username||u.password||(!localHttp&&(!u.hostname.includes(".")||/^(localhost|127\.|0\.|\[|10\.|192\.168\.)/.test(u.hostname)||u.hostname.endsWith(".localhost"))))return null;return new URL("/apply",u.origin).href;}catch{return null;}
}
export function createApplicationPanel(value=process.env.PUBLIC_SITE_URL){
 const url=applicationSiteUrl(value);if(!url)throw Error("PUBLIC_SITE_URL не настроен: публикация виджета заявок пропущена.");
 const container=new ContainerBuilder().setAccentColor(0xd4af37).addTextDisplayComponents(new TextDisplayBuilder().setContent("# Вступление в семью LONDO\nХочешь стать частью LONDO?\n\nТеперь заявки на вступление принимаются через наш официальный сайт.\n\nДля подачи заявки необходимо:\n• Авторизоваться через Discord.\n• Находиться на Discord-сервере LONDO.\n• Выбрать семью MEMPHIS или PHOENIX.\n• Заполнить анкету.\n\nПосле отправки заявка поступит на рассмотрение рекрутерам."))
 .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Подать заявку на сайте ↗").setURL(url)))
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${MARKER}`));
 return {flags:MessageFlags.IsComponentsV2 as const,components:[container],allowedMentions:{parse:[] as []}};
}
function missing(error:unknown){return !!error&&typeof error==="object"&&"code" in error&&error.code===10008;}
let publishing:Promise<string|null>|null=null;
export async function ensureApplicationPanel(guild:Guild,channelId:string):Promise<string|null>{
 if(!applicationSiteUrl()){logWarning("[Applications] PUBLIC_SITE_URL не настроен: публикация виджета пропущена.");return null;}
 if(publishing)return publishing;
 publishing=(async()=>{
  const channel=await guild.channels.fetch(channelId);if(!channel?.isTextBased()||!channel.isSendable())throw Error("Канал заявок недоступен.");
  let saved:Record<string,string>={};try{saved=JSON.parse(await readFile(file,"utf8"));}catch(e){if(!(e&&typeof e==="object"&&"code" in e&&e.code==="ENOENT"))throw Error("Не удалось прочитать ID виджета.");}
  const key=`${guild.id}:${channelId}`,known=saved[key]??process.env.APPLICATION_PANEL_MESSAGE_ID;
  let current=known?await channel.messages.fetch(known).catch(e=>{if(missing(e))return null;throw e;}):null;
  if(current&&current.author.id!==guild.client.user.id)throw Error("Настроенный виджет не принадлежит боту.");
  if(!current){let before:string|undefined;for(;;){const recent=await channel.messages.fetch({limit:100,...(before?{before}:{})});current=recent.find(m=>m.author.id===guild.client.user.id&&(m.embeds.some(e=>e.title===OLD_TITLE)||JSON.stringify(m.components).includes(MARKER)))??null;if(current||recent.size<100)break;before=recent.last()?.id;}}
  const panel=createApplicationPanel();
  if(current){try{await current.edit({...panel,content:null,embeds:[],attachments:[]});}catch(e){if(!missing(e)&&!(e&&typeof e==="object"&&"code" in e&&e.code===50035))throw e;current=await channel.send(panel);}}
  else current=await channel.send(panel);
  saved[key]=current.id;await mkdir(dirname(file),{recursive:true});await writeFile(file+".tmp",JSON.stringify(saved));await rename(file+".tmp",file);return current.id;
 })();try{return await publishing;}finally{publishing=null;}
}
export async function publishApplicationPanel(interaction:ChatInputCommandInteraction,channelId:string){
 if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)){await interaction.reply({content:"Команда доступна только администраторам сервера.",ephemeral:true});return;}
 await interaction.deferReply({flags:MessageFlags.Ephemeral});
 try{const id=interaction.guild?await ensureApplicationPanel(interaction.guild,channelId):null;await interaction.editReply(id?"Панель подачи заявки обновлена.":"PUBLIC_SITE_URL не настроен: публикация пропущена.");}catch{await interaction.editReply("Не удалось обновить виджет. Проверьте канал и права бота.");}
}
export async function handleApplicationInteraction(interaction:Interaction):Promise<boolean>{
 if(!((interaction.isStringSelectMenu()||interaction.isButton()||interaction.isModalSubmit())&&(interaction.customId.startsWith("londo:applications:")||interaction.customId.startsWith("family-application:"))))return false;
 const url=applicationSiteUrl();
 await interaction.reply({content:"Подача заявок перенесена на сайт LONDO."+(url?"":" Публичная ссылка пока не настроена."),flags:MessageFlags.Ephemeral,components:url?[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Подать заявку на сайте").setURL(url))]:[]});return true;
}
export function registerApplicationCommand(guild:Guild,extraCommands:ApplicationCommandDataResolvable[]=[]):Promise<unknown>{return guild.commands.set([
 {name:"setup-applications",description:"Опубликовать или обновить панель заявок"},{name:"setup-leaderboard",description:"Создать или обновить лидерборд"},{name:"test-welcome",description:"Проверить welcome-сообщение"},{name:"setup-guide",description:"Опубликовать или обновить guide-панель"},...extraCommands]);}
