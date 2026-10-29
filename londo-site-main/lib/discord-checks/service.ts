import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { canEditFamilyApplication, isEditableApplicationStatus } from "@/lib/applications/edit-policy";
import { parseApplicationAnswers } from "@/lib/applications/answers";
import { isActiveApplicationConflict } from "@/lib/applications/intake";
import { shopBot } from "@/lib/shop/bot";
import { seal, unseal } from "./crypto";
import { CheckError, tokenRequest, readGuilds, type Tokens } from "./discord-api";
import { hasFreshRoles, visibleRoles, ROLE_CACHE_MS, ROLE_BATCH_LIMIT, LONDO_GUILD_ID, RETENTION_MS, matchGuilds, validateWatchlist, type GuildResult } from "./policy";

import {candidateRoleQueue} from "./role-queue";
import {readMemberRoles} from "./member-roles";

export async function membership(discordId:string):Promise<"MEMBER"|"NOT_MEMBER"|"UNAVAILABLE"> {
 try { const r=await shopBot<{status:string}>("/internal/discord/applications/member",{discordId});return r.status==="MEMBER"||r.status==="NOT_MEMBER"?r.status:"UNAVAILABLE"; }catch{return "UNAVAILABLE";}
}
export async function pruneChecks(){
 const now=new Date();
 await prisma.$transaction([
  prisma.discordApplicationCheck.deleteMany({where:{expiresAt:{lte:now}}}),
  prisma.discordOAuthConsent.updateMany({where:{expiresAt:{lte:now},credentials:{not:null}},data:{credentials:null,revokedAt:now}}),
 ]);
}
export async function submitOnSite(user:SessionUser,family:unknown,input:unknown){
 if(family!=="MEMPHIS")throw Error("Выберите сервер.");
 const answers=parseApplicationAnswers(input);if(!answers)throw Error("Проверьте ответы: все поля обязательны, возраст 16–99, ссылка http/https.");
 if(Array.from(answers.gameNickname).length>32)throw Error("Никнейм Discord из анкеты не должен превышать 32 символа.");
 const member=await membership(user.discordId);
 if(member!=="MEMBER")throw Error(member==="NOT_MEMBER"?"Для подачи заявки необходимо находиться на Discord-сервере LONDO.":"Проверка Discord временно недоступна. Это не означает, что вас нет на сервере. Попробуйте позже или сообщите администрации.");
 // Consent can be refused; this never blocks submitting the application itself.
 try{return await prisma.$transaction(async tx=>{
  const application=await tx.familyApplication.create({data:{family,discordUserId:user.discordId,discordUsername:user.username,discordDisplayName:user.displayName,discordAvatar:user.avatarUrl,answers,status:"NEW"}});
  await tx.auditLog.create({data:{action:"APPLICATION_CREATED",actorId:user.id,targetId:application.id,targetType:"FamilyApplication",metadata:{family,source:"WEBSITE"}}});return {id:application.id};
 });}catch(e){if(isActiveApplicationConflict(e))throw Error("У вас уже есть активная заявка в эту семью.");throw e;}
}
export async function revokeConsent(user:SessionUser){
 await prisma.$transaction(async tx=>{
  // Lock also serializes against credential refresh and check result persistence.
  await tx.$queryRaw`SELECT id FROM "DiscordOAuthConsent" WHERE "userId"=${user.id} FOR UPDATE`;
  await tx.discordOAuthConsent.updateMany({where:{userId:user.id},data:{revokedAt:new Date(),credentials:null}});
  await tx.discordApplicationCheck.deleteMany({where:{application:{discordUserId:user.discordId}}});
  await tx.auditLog.create({data:{action:"DISCORD_CONSENT_REVOKED",actorId:user.id,targetType:"User",targetId:user.id}});
 });
}
async function credentials(discordId:string){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "DiscordOAuthConsent" WHERE "discordId"=${discordId} FOR UPDATE`;
  const row=await tx.discordOAuthConsent.findUnique({where:{discordId}});
  if(!row||row.revokedAt||!row.credentials||row.expiresAt<=new Date())throw new CheckError("CONSENT_REQUIRED");
  let tokens=unseal<Tokens>(row.credentials);
  if(!row.tokenExpiresAt||row.tokenExpiresAt.getTime()<Date.now()+60000){
   tokens=await tokenRequest({grant_type:"refresh_token",refresh_token:tokens.refresh_token});
   await tx.discordOAuthConsent.update({where:{id:row.id},data:{credentials:seal(tokens),scopes:tokens.scope,tokenExpiresAt:new Date(Date.now()+tokens.expires_in*1000)}});
  }
  return {tokens,consentedAt:row.consentedAt,id:row.id};
 },{timeout:20000});
}
async function staffApplication(user:SessionUser,id:string){
 if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id))throw Error("Некорректная заявка.");
 const app=await prisma.familyApplication.findUnique({where:{id}});
 if(!app||!canEditFamilyApplication(user,app.family))throw Error("Недостаточно прав для проверки заявки этой семьи.");return app;
}
export async function checkView(user:SessionUser,id:string){
 const app=await staffApplication(user,id);await pruneChecks();
 const consent=await prisma.discordOAuthConsent.findUnique({where:{discordId:app.discordUserId},select:{revokedAt:true,expiresAt:true}});
 const latest=await prisma.discordApplicationCheck.findFirst({where:{applicationId:id},orderBy:{checkedAt:"desc"}});
 const previous=consent&&!consent.revokedAt&&consent.expiresAt>new Date()?await prisma.discordApplicationCheck.findFirst({where:{applicationId:id,status:"SUCCESS",expiresAt:{gt:new Date()}},orderBy:{checkedAt:"desc"}}):null;
 const snapshot=previous?.resultSnapshot;
 const guilds=Array.isArray(snapshot)?snapshot as unknown as GuildResult[]:[];
 const rows=matchGuilds(guilds.map(g=>visibleRoles(g)),await prisma.discordGuildWatchlist.findMany({select:{guildId:true,enabled:true}}));
 return {candidate:app.discordDisplayName,discordId:app.discordUserId,status:!consent||consent.revokedAt||consent.expiresAt<=new Date()?"CONSENT_REQUIRED":latest?.status??"NOT_CHECKED",checkedAt:previous?.checkedAt.toISOString()??null,previous:!!previous&&previous.id!==latest?.id,guilds:rows,matches:rows.filter(g=>g.matched).length};
}
export async function runCheck(user:SessionUser,id:string){
 const app=await staffApplication(user,id);
 if(!isEditableApplicationStatus(app.status))throw Error("Заявка завершена. Доступна только сохранённая проверка.");
 const attempt=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM family_applications WHERE id=${id} FOR UPDATE`;
  const current=await tx.familyApplication.findUniqueOrThrow({where:{id}});
  if(!isEditableApplicationStatus(current.status)||current.operationLock)throw Error("Заявка уже обрабатывается или завершена.");
  const recent=await tx.discordApplicationCheck.findFirst({where:{applicationId:id,OR:[{checkedAt:{gt:new Date(Date.now()-30000)}},{status:"RUNNING",checkedAt:{gt:new Date(Date.now()-180000)}}]}});
  if(recent)throw Error("Проверка уже выполняется или была запущена недавно. Повторите позже.");
  await tx.auditLog.create({data:{action:"APPLICATION_DISCORD_CHECK_STARTED",actorId:user.id,targetType:"FamilyApplication",targetId:id,metadata:{family:app.family}}});
  return tx.discordApplicationCheck.create({data:{applicationId:id,checkedByUserId:user.id,status:"RUNNING",matchedGuildIds:[],expiresAt:new Date(Date.now()+RETENTION_MS)}});
 });
 try{
  const credential=await credentials(app.discordUserId);
  const guilds=await readGuilds(credential.tokens.access_token,credential.tokens.scope);
  const saved=await prisma.discordApplicationCheck.findFirst({where:{applicationId:id,status:"SUCCESS",expiresAt:{gt:new Date()}},orderBy:{checkedAt:"desc"}});
  const cached=Array.isArray(saved?.resultSnapshot)?saved.resultSnapshot as unknown as GuildResult[]:[];
  for(let i=0;i<guilds.length;i++){const previous=cached.find(g=>g.id===guilds[i].id);if(previous&&hasFreshRoles(previous))guilds[i]={...previous,name:guilds[i].name,icon:guilds[i].icon};}
  await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "DiscordOAuthConsent" WHERE id=${credential.id} FOR UPDATE`;
   const consent=await tx.discordOAuthConsent.findUnique({where:{id:credential.id}});
   if(!consent||consent.revokedAt||consent.expiresAt<=new Date()||consent.consentedAt.getTime()!==credential.consentedAt.getTime())throw new CheckError("CONSENT_REQUIRED");
   const rows=matchGuilds(guilds,await tx.discordGuildWatchlist.findMany());
   await tx.discordApplicationCheck.update({where:{id:attempt.id},data:{status:"SUCCESS",resultSnapshot:guilds,matchedGuildIds:rows.filter(r=>r.matched).map(r=>r.id)}});
   await tx.discordOAuthConsent.update({where:{id:consent.id},data:{lastCheckedAt:new Date()}});
  });
 }catch(e){await prisma.discordApplicationCheck.updateMany({where:{id:attempt.id},data:{status:e instanceof CheckError?e.code:"UNAVAILABLE"}});}
 return checkView(user,id);
}
export async function loadApplicationRoles(user:SessionUser,id:string,guildId:unknown,watchlistOnly=false){
 const app=await staffApplication(user,id);
 if(!isEditableApplicationStatus(app.status))throw Error("Заявка завершена. Доступна только сохранённая проверка.");
 const view=await checkView(user,id);
 if(view.status==="CONSENT_REQUIRED")throw Error("Кандидату нужно разрешить проверку на /apply.");
 if(!watchlistOnly&&(typeof guildId!=="string"||!/^\d{17,20}$/.test(guildId)))throw Error("Некорректный Guild ID.");
 const targets=watchlistOnly?view.guilds.filter(g=>g.matched&&!hasFreshRoles(g)).slice(0,ROLE_BATCH_LIMIT):view.guilds.filter(g=>g.id===guildId);
 if(!watchlistOnly&&!targets.length)throw Error("Сервер отсутствует в проверке кандидата.");
 for(const target of targets){
  if(hasFreshRoles(target))continue;
  const credential=await credentials(app.discordUserId);
  const queue=candidateRoleQueue(`${app.discordUserId}:${credential.consentedAt.toISOString()}`);
  let result:GuildResult;
  if(target.id===LONDO_GUILD_ID){
   try{result=await candidateRoleQueue(`LONDO_BOT:${credential.consentedAt.toISOString()}`).run<GuildResult>(app.discordUserId,async()=>{
    const response=await shopBot<{status:string;roles?:string[];roleNames?:Record<string,string>}>("/internal/discord/applications/member-roles",{discordId:app.discordUserId});
    const valid=response.status==="MEMBER"&&Array.isArray(response.roles)&&response.roles.every(role=>/^\d{17,20}$/.test(role));
    return {id:target.id,name:target.name,icon:target.icon,roles:valid?response.roles!:null,roleStatus:valid?"AVAILABLE":"UNAVAILABLE",roleSource:"BOT",roleCheckedAt:new Date().toISOString(),...(valid&&response.roleNames?{roleNames:response.roleNames}:{})};
   },ROLE_CACHE_MS,result=>result.roleStatus==="AVAILABLE");}catch{result={id:target.id,name:target.name,icon:target.icon,roles:null,roleStatus:"API_ERROR",roleSource:"BOT",roleCheckedAt:new Date().toISOString()};}
  }else result=await readMemberRoles(target,credential.tokens.access_token,credential.tokens.scope,queue);
  // Recheck consent, application status and access before persisting or exposing a result.
  await staffApplication(user,id);
  await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "DiscordOAuthConsent" WHERE id=${credential.id} FOR UPDATE`;
   const consent=await tx.discordOAuthConsent.findUnique({where:{id:credential.id}});
   const current=await tx.familyApplication.findUniqueOrThrow({where:{id}});
   if(!consent||consent.revokedAt||consent.expiresAt<=new Date()||consent.consentedAt.getTime()!==credential.consentedAt.getTime())throw Error("Согласие отозвано. Повторите авторизацию.");
   if(!isEditableApplicationStatus(current.status)||current.operationLock)throw Error("Заявка уже обрабатывается или завершена.");
   const snapshot=await tx.discordApplicationCheck.findFirst({where:{applicationId:id,status:"SUCCESS",expiresAt:{gt:new Date()}},orderBy:{checkedAt:"desc"}});
   if(!snapshot)return;
   await tx.$queryRaw`SELECT id FROM "DiscordApplicationCheck" WHERE id=${snapshot.id} FOR UPDATE`;
   const locked=await tx.discordApplicationCheck.findUniqueOrThrow({where:{id:snapshot.id}});
   const rows=Array.isArray(locked.resultSnapshot)?locked.resultSnapshot as unknown as GuildResult[]:[];
   await tx.discordApplicationCheck.update({where:{id:locked.id},data:{resultSnapshot:rows.map(g=>g.id===target.id?result:g)}});
  });
  if(result.roleStatus==="RATE_LIMITED")break;
 }
 return checkView(user,id);
}
export function requireWatchlistManager(user:SessionUser){if(user.effectiveAccess!=="FULL_ACCESS"&&(user.effectiveAccess!=="OWNER"||!user.pinVerified))throw Error("Управлять списком может только администрация сообщества.");}
export async function saveWatchlist(user:SessionUser,id:unknown,value:unknown,remove=false){
 requireWatchlistManager(user);
 if(id!==null&&(typeof id!=="string"||!/^\w{1,64}$/.test(id)))throw Error("Некорректный сервер.");
 return prisma.$transaction(async tx=>{
  const before=typeof id==="string"?await tx.discordGuildWatchlist.findUniqueOrThrow({where:{id}}):null;
  if(remove&&!before)throw Error("Сервер не найден.");
  const data=remove?null:validateWatchlist(value);
  const after=remove?await tx.discordGuildWatchlist.delete({where:{id:before!.id}}):before?await tx.discordGuildWatchlist.update({where:{id:before.id},data:data!}):await tx.discordGuildWatchlist.create({data:{...data!,createdByUserId:user.id}});
  await tx.auditLog.create({data:{action:remove?"DISCORD_WATCHLIST_DELETED":before?"DISCORD_WATCHLIST_UPDATED":"DISCORD_WATCHLIST_CREATED",actorId:user.id,targetType:"DiscordGuildWatchlist",targetId:after.id,metadata:{guildId:after.guildId,before:before?{name:before.name,inviteUrl:before.inviteUrl,enabled:before.enabled}:null,after:remove?null:data}}});return {ok:true};
 });
}
