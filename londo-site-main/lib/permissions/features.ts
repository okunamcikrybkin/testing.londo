// Shared by navigation and all server guards. Feature access is explicit because rank order does not imply inherited permissions.
export const ACCESS_ORDER = {USER:0,FAMQ:1,RECRUIT:2,CURATOR:3,HIGH_STAFF:4,DEP_OWNER:5,OWNER:6,FULL_ACCESS:7} as const;
export type AccessLevel = keyof typeof ACCESS_ORDER;
export const FEATURE_ACCESS = {
 discordChecks:["OWNER","FULL_ACCESS"], roulette:["FAMQ","RECRUIT","CURATOR","HIGH_STAFF","DEP_OWNER","OWNER","FULL_ACCESS"],
 rouletteAdmin:["OWNER","FULL_ACCESS"], promotionSettings:["OWNER","FULL_ACCESS"], dashboard:["RECRUIT","CURATOR","DEP_OWNER","OWNER","FULL_ACCESS"], accessManagement:["OWNER","FULL_ACCESS"],
 notifications:["OWNER","FULL_ACCESS"], factionRoles:["OWNER","FULL_ACCESS"], giveaways:["OWNER","FULL_ACCESS"], shopManage:["OWNER","FULL_ACCESS"],
 logs:["DEP_OWNER","OWNER","FULL_ACCESS"], discordLogs:["DEP_OWNER","OWNER","FULL_ACCESS"], economy:["FULL_ACCESS"], rankColors:["OWNER","FULL_ACCESS"],
 recruitStatistics:["CURATOR","DEP_OWNER","OWNER","FULL_ACCESS"], profile:["USER","FAMQ","RECRUIT","CURATOR","HIGH_STAFF","DEP_OWNER","OWNER","FULL_ACCESS"],
 aboutLondo:["USER","FAMQ","RECRUIT","CURATOR","HIGH_STAFF","DEP_OWNER","OWNER","FULL_ACCESS"],
 ownAccess:["USER","FAMQ","RECRUIT","CURATOR","HIGH_STAFF","DEP_OWNER","OWNER","FULL_ACCESS"],
 promotionApply:["FAMQ","RECRUIT","CURATOR","HIGH_STAFF","DEP_OWNER","OWNER","FULL_ACCESS"], resetPin:["FULL_ACCESS"],
} as const satisfies Record<string,readonly AccessLevel[]>;
export type Feature = keyof typeof FEATURE_ACCESS;
export function meetsAccess(access:string,minimum:AccessLevel):boolean {
 return Object.hasOwn(ACCESS_ORDER,access) && ACCESS_ORDER[access as AccessLevel]>=ACCESS_ORDER[minimum];
}
export function canUseFeature(access:string,feature:Feature):boolean {return FEATURE_ACCESS[feature].some(level=>level===access);}
export const FEATURE_NAVIGATION: readonly {feature:Feature;href:string;label:string}[] = [
 {feature:"profile",href:"/profile",label:"Профиль"},
 {feature:"aboutLondo",href:"/about",label:"О LONDO"},
 {feature:"ownAccess",href:"/access",label:"Доступ"},
 {feature:"roulette",href:"/roulette",label:"Рулетка"},
 {feature:"dashboard",href:"/dashboard",label:"Панель рекрута"},
 {feature:"giveaways",href:"/giveaways",label:"Розыгрыши"},
 {feature:"shopManage",href:"/shop",label:"Магазин"},
 {feature:"logs",href:"/logs?source=site",label:"Аудит сайта"},
 {feature:"discordLogs",href:"/logs?source=discord",label:"Аудит Discord"},
 {feature:"promotionSettings",href:"/promotions/admin",label:"Настройки повышений"},
 {feature:"rouletteAdmin",href:"/roulette/admin",label:"Управление колесом"},
 {feature:"accessManagement",href:"/access/manage",label:"Доступы"},
 {feature:"notifications",href:"/notification-settings",label:"Уведомления"},
 {feature:"factionRoles",href:"/faction-roles",label:"Роли фракций"},
 {feature:"rankColors",href:"/settings/rank-colors",label:"Цвета рангов"},
 {feature:"discordChecks",href:"/settings/discord-checks",label:"Проверка Discord"},
 {feature:"economy",href:"/economy",label:"Управление монетами"},
 {feature:"recruitStatistics",href:"/recruit-statistics",label:"Статистика рекрутов"},
 {feature:"promotionApply",href:"/promotions/apply",label:"Повышения"},
];
// Group presentation only: original route policies remain in FEATURE_NAVIGATION.
const SETTINGS_FEATURES: readonly Feature[] = ["accessManagement","rouletteAdmin","promotionSettings","notifications","factionRoles","rankColors","discordChecks","giveaways","shopManage","economy"];
export const FAMILY_SETTINGS_TABS = SETTINGS_FEATURES.map(feature => FEATURE_NAVIGATION.find(item => item.feature === feature)!);
export const familySettingsForAccess = (access: string) => FAMILY_SETTINGS_TABS.filter(item => canUseFeature(access,item.feature));
export function familySettingsTabForPath(path: string) {
 const clean=path.split("?")[0];
 return FAMILY_SETTINGS_TABS.find(item => clean===item.href || clean.startsWith(item.href+"/"));
}
const navItem = (feature: Feature) => FEATURE_NAVIGATION.find(item => item.feature === feature)!;
export const MAIN_NAV_ITEMS = ["aboutLondo","roulette","dashboard","ownAccess","promotionApply"].map(feature => navItem(feature as Feature));
export const USER_MENU_ITEMS = [navItem("profile")];
export const userMenuForAccess = (access:string) => {
 const adminPages=familySettingsForAccess(access);
 return [
  ...USER_MENU_ITEMS.filter(item=>canUseFeature(access,item.feature)),
  ...(adminPages.length ? [{feature:adminPages[0].feature,href:"/family-settings",label:"Панель администратора"}] : []),
  ...(canUseFeature(access,"recruitStatistics") ? [navItem("recruitStatistics")] : []),
  ...(canUseFeature(access,"logs") ? [navItem("logs"),navItem("discordLogs")] : []),
 ];
};
export function navigationForAccess(access:string) {
 return MAIN_NAV_ITEMS.filter(item=>canUseFeature(access,item.feature));
}
export function isNavigationCurrent(href:string,path:string):boolean {
 const target=new URL(href,"https://londo.invalid"),current=new URL(path,"https://londo.invalid");
 if(target.pathname==="/logs"&&current.pathname==="/logs")return (target.searchParams.get("source")??"site")===(current.searchParams.get("source")??"site");
 if(target.pathname==="/logs"&&/^\/logs\/(audit|event)_/.test(current.pathname))return (target.searchParams.get("source")??"site")===(current.searchParams.get("source")??"site");
 const clean=path.split(/[?#]/)[0];
 const management=!!familySettingsTabForPath(clean);
 if(href==="/access" && management)return false;
 if(href==="/roulette" && clean.startsWith("/roulette/admin"))return false;
 if(href==="/family-settings" && management)return true;
 return clean===href || (href!=="/" && clean.startsWith(href+"/"));
}
export function featureForPage(path:string):Feature|null {
 const [pathname,query] = path.split("?",2);
 if(/^\/logs\/event_/.test(pathname))return "discordLogs";
 if(/^\/logs(?:\/|$)/.test(pathname))return pathname==="/logs"&&new URLSearchParams(query??"").get("source")==="discord"?"discordLogs":"logs";
  const p=path.split("?")[0];
 // The entry route participates in the existing staff-session PIN gate.
 if(p==="/family-settings")return "accessManagement";
 if(/^\/roulette\/admin(?:\/|$)/.test(p))return "rouletteAdmin";
 return FEATURE_NAVIGATION.filter(i=>p===i.href||p.startsWith(i.href+"/")).sort((a,b)=>b.href.length-a.href.length)[0]?.feature??null;
}
