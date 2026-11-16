import {canUseFeature} from "../permissions/features";
export const DEFAULT_RANK_COLOR="#E5E7EB";
export type RankColors=Record<string,string>;
export function canManageRankColors(user:{effectiveAccess:string;status:string}|null){return user?.status==="ACTIVE"&&canUseFeature(user.effectiveAccess,"rankColors");}
export function normalizeRankColor(value:unknown){if(typeof value!=="string"||!/^#[0-9a-fA-F]{6}$/.test(value))throw Error("Цвет должен быть в формате #RRGGBB.");return value.toUpperCase();}
export function getRankColor(roleId:string|null|undefined,colors:RankColors={}){if(!roleId)return DEFAULT_RANK_COLOR;try{return normalizeRankColor(colors[roleId]);}catch{return DEFAULT_RANK_COLOR;}}
export function validateRankColors(body:unknown,ranks:readonly {roleId:string}[]):RankColors {
 if(!body||typeof body!=="object"||Array.isArray(body))throw Error("Некорректные цвета рангов.");
 const entries=Object.entries(body);if(entries.length!==ranks.length)throw Error("Передайте цвета всех доступных рангов.");
 const result:RankColors={};for(const [roleId,color] of entries){if(!ranks.some(r=>r.roleId===roleId))throw Error("Неизвестный ранг.");result[roleId]=normalizeRankColor(color);}return result;
}
export function defaultRankColors(ranks:readonly {roleId:string}[]):RankColors{return Object.fromEntries(ranks.map(r=>[r.roleId,DEFAULT_RANK_COLOR]));}
