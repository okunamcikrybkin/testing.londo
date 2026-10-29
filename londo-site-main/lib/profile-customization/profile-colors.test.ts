import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {defaultSettings,validateSettings,profileProjection,type ProfileSettings} from "./settings";
import {DEFAULT_PROFILE_TOP,DEFAULT_PROFILE_BOTTOM,profileAppearance} from "./surface-colors";

for(const key of ["profileTopColor","profileBottomColor"] as const){
 test(`${key} normalizes and survives save payload roundtrip`,()=>{
  const settings=validateSettings({...defaultSettings(),[key]:"#a1B2c3"},[]);
  assert.equal(settings[key],"#A1B2C3");
  assert.equal(validateSettings(JSON.parse(JSON.stringify(settings)),[])[key],"#A1B2C3");
 });
 test(`${key} rejects invalid values and CSS injection`,()=>{
  for(const value of ["123456","#fff","#12345678","#GG0000","red","var(--x)","#FFFFFF;display:none","url(https://example.com)",123,{}])assert.throws(()=>validateSettings({...defaultSettings(),[key]:value},[]));
 });
}
test("missing colors use neutral defaults, independently of legacy theme",()=>{
 const old:Record<string,unknown>={...defaultSettings(),theme:"RED"};delete old.profileTopColor;delete old.profileBottomColor;
 const settings=validateSettings(old,[]);
 assert.equal(settings.profileTopColor,DEFAULT_PROFILE_TOP);assert.equal(settings.profileBottomColor,DEFAULT_PROFILE_BOTTOM);
 assert.equal(profileAppearance({...settings,profileTopColor:"url(x)"})["--profile-top-color"],DEFAULT_PROFILE_TOP);
 assert.equal(profileAppearance({...settings,profileBottomColor:"#fff;"})["--profile-bottom-color"],DEFAULT_PROFILE_BOTTOM);
});
test("top, bottom and accent are independent preview variables",()=>{
 const settings=defaultSettings(),base=profileAppearance(settings);
 assert.deepEqual(profileAppearance({...settings,profileTopColor:"#FF0000"}),{...base,"--profile-top-color":"#FF0000"});
 assert.deepEqual(profileAppearance({...settings,profileBottomColor:"#00FFFF"}),{...base,"--profile-bottom-color":"#00FFFF"});
 assert.deepEqual(profileAppearance({...settings,accentColor:"#123456"}),{...base,"--profile-accent":"#123456"});
});

test("real ProfileView ignores legacy fields and renders saved colors for owner/public",async()=>{
 const require=createRequire(import.meta.url),esbuild=require("esbuild"),dir=mkdtempSync(join(tmpdir(),"londo-colors-"));
 try{
  esbuild.buildSync({stdin:{contents:`import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{ProfileView}from'./components/profile/profile-view';export const render=(props)=>renderToStaticMarkup(<ProfileView {...props}/>);`,loader:"tsx",resolveDir:process.cwd()},bundle:true,platform:"node",format:"cjs",jsx:"automatic",outfile:join(dir,"render.cjs"),loader:{".module.css":"local-css"},logLevel:"silent"});
  const {render}=require(join(dir,"render.cjs")) as {render:(props:unknown)=>string};
  const profile={displayName:"Test",gameNickname:"Roleplay Name",staticId:"456",characters:[{name:"Second",staticId:"789",enabled:true,sortOrder:0}],avatarUrl:null,discordId:"private-id",availableBadges:[]};
  const settings={...defaultSettings(),showStaticId:true,characters:profile.characters,profileTopColor:"#123456",profileBottomColor:"#654321",bannerPreset:"NONE" as const};
  const expected=render({profile,settings});
  for(const patch of [{theme:"RED"},{theme:"GOLD"},{cardStyle:"GLASS"},{cardStyle:"SOLID"},{layout:"COMPACT"},{layout:"SHOWCASE"}])assert.equal(render({profile,settings:{...settings,...patch}}),expected);
  for(const owner of [false,true]){
   const html=render({...profileProjection(profile,settings,owner),owner});
   assert.match(html,/--profile-top-color:#123456/);assert.match(html,/--profile-bottom-color:#654321/);
   assert.match(html,/Roleplay Name/);assert.match(html,/\| #456/);assert.match(html,/Дополнительные персонажи/);assert.match(html,/Second/);assert.match(html,/Статик #789/);
   assert.match(html,/data-layout="CLASSIC"/);assert.match(html,/data-card="MATTE"/);
   assert.ok(!html.includes("private-id"));
  }
  const invalid={...settings,profileTopColor:"url(evil)",profileBottomColor:"#fff;"} as ProfileSettings;
  assert.ok(!render({profile,settings:invalid}).includes("url(evil)"));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test("worst-case white profile surfaces retain WCAG AA body text contrast",()=>{
 const lum=(rgb:number[])=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
 const brightest=[16,16,21].map(v=>255*.12+v*.88);
 // The muted text is the darkest body text; other surfaces only add dark overlays.
 assert.ok((lum([183,179,191])+.05)/(lum(brightest)+.05)>=4.5);
});
