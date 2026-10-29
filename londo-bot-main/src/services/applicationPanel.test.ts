import assert from "node:assert/strict";
import test from "node:test";
import type {Guild,Interaction} from "discord.js";
import {MessageFlags} from "discord.js";
import {applicationSiteUrl,createApplicationPanel,handleApplicationInteraction,ensureApplicationPanel} from "./applicationPanel.js";
import {applicationMembership,applicationMemberRoles} from "./applicationMembership.js";
import {validateApplicationAnswers} from "./applicationIntake.js";
test("application panel explains the joining process and links to the application form",()=>{const panel=createApplicationPanel("https://londo.example");assert.equal(panel.flags,MessageFlags.IsComponentsV2);const text=JSON.stringify(panel);assert.match(text,/https:\/\/londo.example\/apply/);assert.match(text,/Стань частью семьи LONDO/);assert.match(text,/Дождись ответа/);assert.match(text,/Заполнить анкету/);assert.ok(!text.includes("londo-application-panel"));assert.ok(!("embeds" in panel));});
test("invalid public URL never creates a broken Discord button",()=>{for(const url of ["","http://example.com","https://localhost","https://127.0.0.1"]){assert.equal(applicationSiteUrl(url),null);assert.throws(()=>createApplicationPanel(url));}});
test("local HTTP URLs are allowed only outside production",()=>{const old=process.env.NODE_ENV;try{process.env.NODE_ENV="development";assert.equal(applicationSiteUrl("http://localhost:3000"),"http://localhost:3000/apply");assert.equal(applicationSiteUrl("http://127.0.0.1:3000"),"http://127.0.0.1:3000/apply");assert.equal(applicationSiteUrl("http://192.168.1.2:3000"),null);process.env.NODE_ENV="production";assert.equal(applicationSiteUrl("http://localhost:3000"),null);}finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;}});
test("legacy select/button/open modal all return migration reply without submission",async()=>{
 const old=process.env.PUBLIC_SITE_URL;process.env.PUBLIC_SITE_URL="https://londo.example";
 try{for(const kind of ["select","button","modal"]){let reply:unknown;const i={isStringSelectMenu:()=>kind==="select",isButton:()=>kind==="button",isModalSubmit:()=>kind==="modal",customId:kind==="modal"?"londo:applications:modal:MEMPHIS":"londo:applications:family-select",reply:async(v:unknown)=>{reply=v;}};assert.equal(await handleApplicationInteraction(i as unknown as Interaction),true);assert.match(JSON.stringify(reply),/Подача заявок перенесена/);assert.match(JSON.stringify(reply),/https:\/\/londo.example\/apply/);}}finally{if(old===undefined)delete process.env.PUBLIC_SITE_URL;else process.env.PUBLIC_SITE_URL=old;}
});
test("missing URL skips publication including on repeated startup",async()=>{const old=process.env.PUBLIC_SITE_URL;delete process.env.PUBLIC_SITE_URL;try{const guild={} as Guild;assert.equal(await ensureApplicationPanel(guild,"channel"),null);assert.equal(await ensureApplicationPanel(guild,"channel"),null);}finally{if(old!==undefined)process.env.PUBLIC_SITE_URL=old;}});
test("membership does not require roles and distinguishes unknown member from outage",async()=>{
 for(const outcome of [null,10007,50013]){const guild={id:"1545123264605585438",members:{fetch:async()=>{if(outcome)throw {code:outcome};return {roles:[]};}}} as unknown as Guild;assert.deepEqual(await applicationMembership(guild,"1545123264626430067"),{status:outcome===null?"MEMBER":outcome===10007?"NOT_MEMBER":"UNAVAILABLE"});}
});

test("application nickname is kept whole and limited to Discord's 32-character nickname size",()=>{
 const answers={gameNicknameStatic:"Londo Player | 123",oocAge:"20",joinReason:"Хочу вступить",discoverySource:"Discord",charactersScreenshotUrl:"https://example.com/characters.png"};
 assert.equal(validateApplicationAnswers(answers)?.gameNicknameStatic,answers.gameNicknameStatic);
 assert.equal(validateApplicationAnswers({...answers,gameNicknameStatic:"Н".repeat(33)}),null);
});

test("LONDO bot returns actual role IDs, excludes everyone, and never reads foreign guilds",async()=>{
 let calls=0;const guild={id:"1545123264605585438",members:{fetch:async()=>{calls++;return {roles:{cache:new Map([["1545123264605585438",{}],["1545123264626430067",{}]])}};}}} as unknown as Guild;
 assert.deepEqual(await applicationMemberRoles(guild,"1545123264626430067"),{status:"MEMBER",roles:["1545123264626430067"]});
 assert.deepEqual(await applicationMemberRoles({...guild,id:"other"} as Guild,"1545123264626430067"),{status:"UNAVAILABLE"});assert.equal(calls,1);
 const failure={id:guild.id,members:{fetch:async()=>{throw {code:50001,status:403};}}} as unknown as Guild;
 assert.deepEqual(await applicationMemberRoles(failure,"1545123264626430067"),{status:"UNAVAILABLE",code:50001,httpStatus:403});
});
