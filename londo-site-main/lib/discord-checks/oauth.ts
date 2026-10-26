import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { SESSION_COOKIE, hashSessionToken } from "@/lib/auth/discord";
import { prisma } from "@/lib/db/prisma";
import { seal, unseal } from "./crypto";
import { tokenRequest, discordGet } from "./discord-api";
import { CHECK_SCOPES, RETENTION_MS } from "./policy";
import { requireConsentConfiguration } from "./oauth-config";

const COOKIE="londo_discord_check_oauth";
const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/",maxAge:600};
type State={nonce:string;userId:string;discordId:string;sessionHash:string;expires:number;callback:string};
export async function startCheckConsent(origin:string){
 const user=await getCurrentUser();if(!user)throw Error("Необходимо войти через Discord.");
 const jar=await cookies(),session=jar.get(SESSION_COOKIE)?.value;if(!session)throw Error("Необходимо войти через Discord.");
 requireConsentConfiguration(process.env);
 const callback=new URL("/api/auth/discord/callback",process.env.NEXT_PUBLIC_APP_URL||origin).href;
 const state:State={nonce:"check."+randomBytes(32).toString("base64url"),userId:user.id,discordId:user.discordId,sessionHash:hashSessionToken(session),expires:Date.now()+600000,callback};
 let value:string;try{value=seal(state);}catch{throw Error("Проверка Discord пока не настроена администратором.");}
 jar.set(COOKIE,value,cookieOptions);
 const url=new URL("https://discord.com/oauth2/authorize");
 url.search=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID!,redirect_uri:callback,response_type:"code",scope:CHECK_SCOPES,state:state.nonce,prompt:"consent"}).toString();return url.href;
}
export async function finishCheckConsent(request:NextRequest){
 const response=(status:string)=>{const r=NextResponse.redirect(new URL(`/apply?consent=${status}`,request.nextUrl.origin));r.cookies.set(COOKIE,"",{...cookieOptions,maxAge:0});return r;};
 try{
  const encrypted=request.cookies.get(COOKIE)?.value,nonce=request.nextUrl.searchParams.get("state");
  if(!encrypted||!nonce)return response("invalid");const state=unseal<State>(encrypted);
  if(state.expires<Date.now()||nonce.length!==state.nonce.length||!timingSafeEqual(Buffer.from(nonce),Buffer.from(state.nonce)))return response("invalid");
  const user=await getCurrentUser(),session=request.cookies.get(SESSION_COOKIE)?.value;
  if(!user||!session||user.id!==state.userId||user.discordId!==state.discordId||hashSessionToken(session)!==state.sessionHash)return response("account_changed");
  if(request.nextUrl.searchParams.has("error"))return response("declined");
  const code=request.nextUrl.searchParams.get("code");if(!code)return response("invalid");
  const tokens=await tokenRequest({grant_type:"authorization_code",code,redirect_uri:state.callback});
  const identity=await discordGet("/users/@me",tokens.access_token) as {id?:string};
  if(identity.id!==user.discordId)return response("account_changed");
  if(!CHECK_SCOPES.split(" ").every(scope=>tokens.scope.split(" ").includes(scope)))return response("missing_scopes");
  const now=new Date(),data={discordId:user.discordId,scopes:tokens.scope,consentedAt:now,revokedAt:null,credentials:seal(tokens),tokenExpiresAt:new Date(Date.now()+tokens.expires_in*1000),expiresAt:new Date(Date.now()+RETENTION_MS)};
  await prisma.discordOAuthConsent.upsert({where:{userId:user.id},create:{...data,userId:user.id},update:data});
  return response("granted");
 }catch{return response("unavailable");}
}
