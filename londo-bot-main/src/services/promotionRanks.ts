import type {Family} from "../types/family.js";
type Rank={id:string;family:Family;name:string;discordRoleId:string;sortOrder:number;isPosition:boolean};
let ranks:Rank[]=[];
export function setPromotionRanks(value:Rank[]){ranks=value.filter(r=>!r.isPosition).map(r=>({...r}));}
export function resolvePromotionRank(has:(id:string)=>boolean,family:Family){const rank=ranks.filter(r=>r.family===family&&has(r.discordRoleId)).sort((a,b)=>b.sortOrder-a.sortOrder||a.id.localeCompare(b.id))[0];return rank?{key:`promotion_${rank.id}`,label:rank.name,priority:6,roleId:rank.discordRoleId}:null;}
