import test from "node:test";
import assert from "node:assert/strict";
import {familySettingsForAccess,familySettingsTabForPath,navigationForAccess,userMenuForAccess,featureForPage,canUseFeature} from "../permissions/features";
import {isStaffPage} from "./policy";
test("family settings navigation derives visibility and landing from existing feature policies",()=>{
 for(const role of ["USER","FAMQ","RECRUIT"]){assert.equal(familySettingsForAccess(role).length,0);assert.equal(navigationForAccess(role).some(n=>n.href==="/family-settings"),false);}
 assert.deepEqual(familySettingsForAccess("HIGH_STAFF").map(x=>x.label),["Розыгрыши","Магазин"]);
 assert.equal(familySettingsForAccess("OWNER").some(x=>x.feature==="promotionSettings"),true);
 assert.equal(familySettingsForAccess("OWNER").length,9);
 assert.equal(familySettingsForAccess("FULL_ACCESS").length,10);
 assert.equal(familySettingsForAccess("FULL_ACCESS").some(x=>x.href==="/economy"&&x.label==="Управление монетами"),true);
 assert.equal(familySettingsForAccess("OWNER").some(x=>x.href==="/roulette/admin"),true);
 assert.equal(familySettingsForAccess("HIGH_STAFF").some(x=>x.href==="/roulette/admin"),false);
 for(const role of ["HIGH_STAFF","OWNER","FULL_ACCESS"]){
  const tabs=familySettingsForAccess(role),nav=navigationForAccess(role);
  assert.equal(nav.filter(n=>n.href==="/family-settings").length,0);
  assert.equal(userMenuForAccess(role).some(n=>n.href==="/family-settings"),true);
  for(const tab of tabs){assert.equal(nav.some(n=>n.href===tab.href),false);assert.equal(canUseFeature(role,tab.feature),true);}
  assert.equal(tabs[0].href,role==="HIGH_STAFF"?"/giveaways":"/access/manage");
 }
});
test("existing direct routes preserve guards, nested tabs and personal PIN flow",()=>{
 for(const path of ["/economy","/economy/users"]){const feature=featureForPage(path)!;assert.equal(canUseFeature("OWNER",feature),false);assert.equal(canUseFeature("HIGH_STAFF",feature),false);assert.equal(canUseFeature("FULL_ACCESS",feature),true);}
 assert.equal(familySettingsTabForPath("/access"),undefined);
 assert.equal(familySettingsTabForPath("/access/pin/verify"),undefined);
 assert.equal(familySettingsTabForPath("/access/manage?tab=active")?.feature,"accessManagement");
 for(const [path,feature] of [
  ["/roulette/admin/history","rouletteAdmin"],
  ["/promotions/admin","promotionSettings"],
  ["/roulette/admin/prizes/new","rouletteAdmin"],
  ["/shop/settings","shopManage"],
  ["/shop/purchases","shopManage"],
  ["/shop/items/new","shopManage"],
  ["/notification-settings","notifications"],
  ["/faction-roles","factionRoles"],
  ["/settings/rank-colors","rankColors"],
  ["/settings/discord-checks","discordChecks"],
  ["/giveaways/123","giveaways"],
 ] as const){assert.equal(familySettingsTabForPath(path)?.feature,feature);}
 assert.equal(isStaffPage("/family-settings"),true);
 assert.equal(isStaffPage("/access"),false);
 assert.equal(isStaffPage("/access/pin/verify"),false);
});
