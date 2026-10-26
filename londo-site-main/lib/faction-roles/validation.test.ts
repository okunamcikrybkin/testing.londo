import test from "node:test";
import assert from "node:assert/strict";
import { canManageFactionRoles, panelInput } from "./validation";
const value={version:1,title:"Выдача ролей фракции",description:"Описание",channelId:"800000000000000001",buttons:[{id:"lspd",name:"LSPD",discordRoleId:"800000000000000002",enabled:true,sortOrder:0}]};
for(const access of ["OWNER","FULL_ACCESS"])test(access+" has faction settings access",()=>assert.equal(canManageFactionRoles(access),true));
for(const access of ["USER","RECRUIT","HIGH_STAFF",""])test(access+" denied faction settings access",()=>assert.equal(canManageFactionRoles(access),false));
test("settings validate real role IDs, limits, enabled state, duplicate roles and ordering",()=>{
 assert.deepEqual(panelInput(value),value);
 assert.equal(panelInput({...value,buttons:[{...value.buttons[0],enabled:false,discordRoleId:null}]}).buttons[0].discordRoleId,null);
 for(const patch of [{discordRoleId:null},{discordRoleId:"fake"},{enabled:"true"},{sortOrder:0.2},{name:""},{id:"bad:role"}])assert.throws(()=>panelInput({...value,buttons:[{...value.buttons[0],...patch}]}));
 assert.throws(()=>panelInput({...value,buttons:Array(26).fill(value.buttons[0])}));
 assert.throws(()=>panelInput({...value,buttons:[value.buttons[0],{...value.buttons[0],id:"other"}]}));
});
