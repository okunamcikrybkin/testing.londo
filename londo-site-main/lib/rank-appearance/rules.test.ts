import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {FAMILY_RANKS} from "./catalog";
import {canManageRankColors,defaultRankColors,validateRankColors,getRankColor,DEFAULT_RANK_COLOR} from "./rules";

test("only active FULL_ACCESS can manage colors, never raw OWNER/HIGH_STAFF",()=>{
 assert.equal(canManageRankColors({effectiveAccess:"FULL_ACCESS",status:"ACTIVE"}),true);
 assert.equal(canManageRankColors({effectiveAccess:"OWNER",status:"ACTIVE"}),true);
 for(const access of ["HIGH_STAFF","RECRUIT","FAMQ","USER"])assert.equal(canManageRankColors({effectiveAccess:access,status:"ACTIVE"}),false);
 assert.equal(canManageRankColors({effectiveAccess:"FULL_ACCESS",status:"BANNED"}),false);assert.equal(canManageRankColors(null),false);
});
test("catalog contains 17 unique canonical role IDs with isolated family roles",()=>{
 assert.equal(FAMILY_RANKS.length,17);assert.equal(new Set(FAMILY_RANKS.map(r=>r.roleId)).size,17);
 assert.equal(FAMILY_RANKS.filter(r=>r.scopes.length===2).length,7);
});
test("HEX normalization and independently configured MEM/PHX recruits",()=>{
 const colors=validateRankColors({...defaultRankColors(),"1545123264643473524":"#00c7a5","1545123264643473523":"#ff5a4f"});
 assert.equal(getRankColor("1545123264643473524",colors),"#00C7A5");assert.equal(getRankColor("1545123264643473523",colors),"#FF5A4F");
});
test("invalid HEX and CSS injection rejected",()=>{
 for(const color of ["red","123456","#fff","#12345678","rgb(1,2,3)","url(x)","var(--x)","expression(x)","#FFFFFF;display:none",null,{}])assert.throws(()=>validateRankColors({...defaultRankColors(),[FAMILY_RANKS[0].roleId]:color}));
});
test("arbitrary ranks, unknown role IDs and rank metadata cannot be created",()=>{
 assert.throws(()=>validateRankColors({...defaultRankColors(),unknown:"#FFFFFF"}));
 const colors:Record<string,unknown>={...defaultRankColors()};delete colors[FAMILY_RANKS[0].roleId];colors.fake="#FFFFFF";assert.throws(()=>validateRankColors(colors));
 assert.throws(()=>validateRankColors({...defaultRankColors(),displayName:"New rank"}));
});
test("missing, unknown and corrupt appearance use fallback",()=>{
 for(const id of [null,undefined,"fake",FAMILY_RANKS[0].roleId])assert.equal(getRankColor(id),DEFAULT_RANK_COLOR);
 assert.equal(getRankColor(FAMILY_RANKS[0].roleId,{[FAMILY_RANKS[0].roleId]:"url(x)"}),DEFAULT_RANK_COLOR);
});

test("profile, public, preview and compact use mapped colors; rank privacy is preserved",()=>{
 const require=createRequire(import.meta.url),esbuild=require("esbuild"),dir=mkdtempSync(join(tmpdir(),"rank-render-"));
 try{
 esbuild.buildSync({stdin:{contents:`import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{ProfileView,ProfileCard}from'./components/profile/profile-view';import{profileProjection,defaultSettings}from'./lib/profile-customization/settings';export const render=(p,s,publicView=false,compact=false)=>{const props=publicView?profileProjection(p,s):{profile:p,settings:s};return renderToStaticMarkup(compact?<ProfileCard {...props} profileHref="/profile/test"/>:<ProfileView {...props}/>)};export{defaultSettings};`,loader:"tsx",resolveDir:process.cwd()},bundle:true,jsx:"automatic",platform:"node",format:"cjs",outfile:join(dir,"render.cjs"),loader:{".module.css":"local-css"},logLevel:"silent"});
 const {render,defaultSettings}=require(join(dir,"render.cjs"));
 const roleId=FAMILY_RANKS[0].roleId,p={displayName:"Member",avatarUrl:null,families:["MEMPHIS","PHOENIX"],ranks:["MEMPHIS · Owner","PHOENIX · Owner"],rankRoleIds:{"MEMPHIS · Owner":roleId,"PHOENIX · Owner":roleId},rankColors:{[roleId]:"#FF0000"}};
 for(const publicView of [true,false])for(const compact of [true,false]){const html=render(p,defaultSettings(),publicView,compact);assert.ok(html.includes(`data-rank-role="${roleId}" style="color:#FF0000`));assert.ok(!html.includes("\\n"));}
 const hidden=render(p,{...defaultSettings(),showRank:false},true,false);assert.ok(!hidden.includes('data-rank-role="'+roleId+'"'));assert.ok(!hidden.includes('color:#FF0000'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test("roster loads rank appearance once for 50 entries, with a shared role color",()=>{
 const require=createRequire(import.meta.url),esbuild=require("esbuild"),dir=mkdtempSync(join(tmpdir(),"rank-query-"));
 writeFileSync(join(dir,"empty.ts"),"export {};");
 writeFileSync(join(dir,"db.ts"),`export let count=0;export const prisma={rankAppearance:{findMany:async()=>{count++;return [{roleId:'1545123264643473521',color:'#F5B942'}]}},familyMembership:{findMany:async()=>Array.from({length:50},(_,i)=>({discordUserId:String(i),rankRoleId:'1545123264643473521',rankDisplayName:'Main',rankPriority:6,identity:{displayName:'Member',username:'member'}}))},afkSession:{findMany:async()=>[]},voiceProfile:{findMany:async()=>[]},user:{findMany:async()=>[]}};`);
 return (async()=>{try{
 esbuild.buildSync({stdin:{contents:`export{getFamilyRoster}from'./lib/roster/data';export{count}from ${JSON.stringify(join(dir,"db.ts"))};`,resolveDir:process.cwd()},bundle:true,platform:"node",format:"cjs",outfile:join(dir,"roster.cjs"),alias:{"@/lib/db/prisma":join(dir,"db.ts"),"server-only":join(dir,"empty.ts")},logLevel:"silent"});
 const bundle=require(join(dir,"roster.cjs"));const rows=await bundle.getFamilyRoster("MEMPHIS");assert.equal(rows.length,50);assert.equal(bundle.count,1);assert.ok(rows.every((r:{rankColor:string})=>r.rankColor==="#F5B942"));
 }finally{rmSync(dir,{recursive:true,force:true});}})();
});
