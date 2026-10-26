import {canUseFeature} from "../permissions/features";
import { object, str, snowflake } from "../promotions/validation";
export function canManageFactionRoles(access: string) { return canUseFeature(access,"factionRoles"); }
export function panelInput(value: unknown) {
  const v=object(value);
  if(!Number.isInteger(v.version)||Number(v.version)<1)throw Error("Обновите страницу.");
  if(!Array.isArray(v.buttons)||v.buttons.length>25)throw Error("Максимум 25 фракций.");
  const buttons=v.buttons.map(raw=>{
    const b=object(raw),id=str(b.id,64,1);
    if(!/^[a-zA-Z0-9_-]+$/.test(id)||typeof b.enabled!=="boolean"||!Number.isInteger(b.sortOrder)||Math.abs(Number(b.sortOrder))>10000)throw Error("Проверьте настройки фракции.");
    const discordRoleId=b.discordRoleId?snowflake(b.discordRoleId):null;
    if(b.enabled&&!discordRoleId)throw Error("Выберите роль для включённой фракции.");
    return {id,name:str(b.name,80,1),discordRoleId,enabled:b.enabled,sortOrder:Number(b.sortOrder)};
  });
  if(new Set(buttons.map(b=>b.id)).size!==buttons.length)throw Error("Повторяющиеся фракции.");
  const ids=buttons.flatMap(b=>b.discordRoleId?[b.discordRoleId]:[]);
  if(new Set(ids).size!==ids.length)throw Error("Каждой фракции нужна отдельная роль.");
  return {version:Number(v.version),channelId:v.channelId?snowflake(v.channelId):null,title:str(v.title,100,1),description:str(v.description,1500),buttons};
}
