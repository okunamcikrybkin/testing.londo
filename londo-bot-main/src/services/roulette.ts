import { PermissionFlagsBits, type Guild } from "discord.js";
import { safeShopRole } from "./shop.js";
type Delivery = { spinId: string; discordUserId: string; roleId: string };
export function validRouletteDelivery(value: unknown): value is Delivery {
  if(!value||typeof value!=="object")return false;
  const b=value as Record<string,unknown>;
  return typeof b.spinId==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(b.spinId)&&typeof b.discordUserId==="string"&&/^\d{17,20}$/.test(b.discordUserId)&&typeof b.roleId==="string"&&/^\d{17,20}$/.test(b.roleId);
}
// This module exposes prize delivery only. There are no Discord spin commands or interactions.
export async function deliverRouletteRole(guild: Guild, body: unknown) {
  if(!validRouletteDelivery(body))throw Error("INVALID_INPUT");
  const [member,role,me]=await Promise.all([guild.members.fetch({user:body.discordUserId,force:true}),guild.roles.fetch(body.roleId),guild.members.fetchMe()]);
  if(!role||role.id===guild.id||role.managed||role.tags?.botId||role.tags?.integrationId)throw Error("ROLE_UNAVAILABLE");
  if(member.roles.cache.has(role.id))return{code:"ALREADY_OWNED"};
  if(!safeShopRole(role,guild.id)||!me.permissions.has(PermissionFlagsBits.ManageRoles)||role.comparePositionTo(me.roles.highest)>=0)throw Error("ROLE_UNAVAILABLE");
  await member.roles.add(role.id,"LONDO Roulette prize "+body.spinId);
  return{code:"GRANTED"};
}
