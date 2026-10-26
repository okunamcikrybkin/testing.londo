import test from "node:test";
import assert from "node:assert/strict";
import { type Guild } from "discord.js";
import { deliverRouletteRole, validRouletteDelivery } from "./roulette.js";
const body={spinId:"roulette-spin",discordUserId:"123456789012345678",roleId:"234567890123456789"};
function fixture({owned=false,safe=true,permission=true,fail=false}={}){
  let grants=0;const cache=new Set(owned?[body.roleId]:[]);
  const guild={id:"345678901234567890",members:{fetch:async()=>({roles:{cache,add:async(id:string)=>{grants++;if(fail)throw Error("Discord timeout");cache.add(id);}}}),fetchMe:async()=>({permissions:{has:()=>permission},roles:{highest:{}}})},roles:{fetch:async()=>({id:body.roleId,managed:!safe,editable:safe,tags:null,comparePositionTo:()=>-1})}} as unknown as Guild;
  return{guild,grants:()=>grants};
}
test("roulette delivery validates identity, role and spin ID",()=>{assert.ok(validRouletteDelivery(body));for(const patch of [{spinId:""},{roleId:"@everyone"},{discordUserId:"123"}])assert.equal(validRouletteDelivery({...body,...patch}),false);assert.equal(validRouletteDelivery(null),false);});
test("roulette role delivery grants once and already-owned is fulfilled",async()=>{const f=fixture();assert.equal((await deliverRouletteRole(f.guild,body)).code,"GRANTED");assert.equal((await deliverRouletteRole(f.guild,body)).code,"ALREADY_OWNED");assert.equal(f.grants(),1);});
test("roulette refuses unsafe or unassignable roles",async()=>{for(const options of [{safe:false},{permission:false}]){const f=fixture(options);await assert.rejects(deliverRouletteRole(f.guild,body));assert.equal(f.grants(),0);}});
test("roulette surfaces transient delivery failure for pending retry",async()=>{const f=fixture({fail:true});await assert.rejects(deliverRouletteRole(f.guild,body),/timeout/);});
