import test from "node:test";
import assert from "node:assert/strict";
import {navigationForAccess,userMenuForAccess,isNavigationCurrent} from "../permissions/features";
test("fixed global navigation and compact user menu for all six access levels",()=>{
 const expected={USER:["О LONDO","Доступ"],FAMQ:["О LONDO","Рулетка","Доступ"],RECRUIT:["О LONDO","Рулетка","Панель рекрута","Доступ"],HIGH_STAFF:["О LONDO","Рулетка","Панель рекрута","Доступ"],OWNER:["О LONDO","Рулетка","Панель рекрута","Доступ"],FULL_ACCESS:["О LONDO","Рулетка","Панель рекрута","Доступ"]};
 for(const [role,labels] of Object.entries(expected)){
  const main=navigationForAccess(role),personal=userMenuForAccess(role);
  assert.deepEqual(main.map(i=>i.label),labels);
  assert.deepEqual(personal.map(i=>i.label),["Профиль",...(role==="HIGH_STAFF"||role==="OWNER"||role==="FULL_ACCESS"?["Панель администратора","Аудит сайта","Аудит Discord"]:[])]);
  assert.equal(main.some(i=>personal.some(p=>p.href===i.href)),false);
 }
});
test("active state separates personal access, management and profile routes",()=>{
 const main=navigationForAccess("FULL_ACCESS");
 for(const path of ["/access","/access/pin/setup","/access/pin/verify?next=/dashboard"])assert.deepEqual(main.filter(i=>isNavigationCurrent(i.href,path)).map(i=>i.label),["Доступ"]);
 for(const path of ["/family-settings","/family-settings/access","/access/manage?tab=active","/shop/settings","/economy","/giveaways/123","/notification-settings","/faction-roles","/settings/rank-colors","/roulette/admin","/roulette/admin/history"]){
  assert.equal(main.some(i=>isNavigationCurrent(i.href,path)),false);
  assert.deepEqual(userMenuForAccess("FULL_ACCESS").filter(i=>isNavigationCurrent(i.href,path)).map(i=>i.label),["Панель администратора"]);
 }
 for(const path of ["/profile","/profile/customize"]){assert.equal(main.some(i=>isNavigationCurrent(i.href,path)),false);assert.equal(userMenuForAccess("USER").filter(i=>isNavigationCurrent(i.href,path)).length,1);}
 assert.equal(userMenuForAccess("USER").some(i=>isNavigationCurrent(i.href,"/settings/interface")),false);
 for(const [path,label] of [["/dashboard","Панель рекрута"],["/roulette","Рулетка"],["/about","О LONDO"]])assert.deepEqual(main.filter(i=>isNavigationCurrent(i.href,path)).map(i=>i.label),[label]);
 assert.deepEqual(userMenuForAccess("HIGH_STAFF").filter(i=>isNavigationCurrent(i.href,"/logs/audit_123?source=site")).map(i=>i.label),["Аудит сайта"]);
 assert.deepEqual(userMenuForAccess("HIGH_STAFF").filter(i=>isNavigationCurrent(i.href,"/logs/event_123?source=discord")).map(i=>i.label),["Аудит Discord"]);
 assert.equal(userMenuForAccess("USER").some(i=>i.href.startsWith("/logs")),false);
});
