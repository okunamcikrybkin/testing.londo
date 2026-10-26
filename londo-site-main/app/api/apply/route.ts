import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { loadApplicationRoles, membership, submitOnSite, revokeConsent, checkView, runCheck, requireWatchlistManager, saveWatchlist, pruneChecks } from "@/lib/discord-checks/service";
import { startCheckConsent } from "@/lib/discord-checks/oauth";

import { ConsentConfigurationError } from "@/lib/discord-checks/oauth-config";

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:NextRequest){
 if(request.headers.get("sec-fetch-site")==="cross-site"||!request.headers.get("origin")||new URL(request.headers.get("origin")!).origin!==request.nextUrl.origin)return json({error:"Запрос отклонён."},403);
 const user=await getCurrentUser();if(!user)return json({error:"Необходима авторизация."},401);
 try{
  const body=await request.json();
  switch(body.operation){
   case "MEMBERSHIP": return json({status:await membership(user.discordId)});
   case "SUBMIT":return json(await submitOnSite(user,body.family,body.answers));
   case "CONSENT":return json({url:await startCheckConsent(request.nextUrl.origin)});
   case "REVOKE":await revokeConsent(user);return json({ok:true});
   case "CHECK":return json(await runCheck(user,String(body.applicationId??"")));
   case "ROLES":return json(await loadApplicationRoles(user,String(body.applicationId??""),body.guildId));
   case "WATCHLIST_ROLES":return json(await loadApplicationRoles(user,String(body.applicationId??""),null,true));
   case "RESULT":return json(await checkView(user,String(body.applicationId??"")));
   case "WATCHLIST":requireWatchlistManager(user);return json(await prisma.discordGuildWatchlist.findMany({orderBy:{createdAt:"desc"}}));
   case "WATCHLIST_SAVE":return json(await saveWatchlist(user,body.id??null,body.value));
   case "WATCHLIST_DELETE":return json(await saveWatchlist(user,body.id,null,true));
   default:return json({error:"Неизвестная операция."},400);
  }
 }catch(e){if(e instanceof ConsentConfigurationError)return json({error:e.message,code:e.code},503);const message=e instanceof Error?e.message:"";return json({error:/prisma|constraint|invocation|connect|Invalid|Unique/i.test(message)?"Операция не выполнена. Проверьте данные; Guild ID не должен повторяться.":message||"Операция не выполнена."},400);}
}
export async function GET(){
 const user=await getCurrentUser();if(!user)return json({error:"Необходима авторизация."},401);
 await pruneChecks();
 const [applications,consent]=await Promise.all([
  prisma.familyApplication.findMany({where:{discordUserId:user.discordId},select:{id:true,family:true,createdAt:true,answers:true,status:true},orderBy:{createdAt:"desc"}}),
  prisma.discordOAuthConsent.findUnique({where:{userId:user.id},select:{consentedAt:true,revokedAt:true,expiresAt:true,scopes:true}}),
 ]);
 return json({applications,needsRoleConsent:!!consent&&!consent.scopes.split(" ").includes("guilds.members.read"),consent:consent&&!consent.revokedAt&&consent.expiresAt>new Date()?"GRANTED":consent?"REVOKED":"NOT_GRANTED"});
}
