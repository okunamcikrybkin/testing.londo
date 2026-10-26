import type {ReactNode} from "react";
import {getRankColor,type RankColors} from "@/lib/rank-appearance/rules";
import {profileNameStyle} from "@/lib/profile-customization/name-accent";
/** Pure presentation: no fetch or per-label database queries. */
export function RankLabel({roleId,colors,children}:{roleId?:string|null;colors?:RankColors;children:ReactNode}){return <span data-rank-role={roleId??undefined} style={profileNameStyle(getRankColor(roleId,colors))}>{children}</span>;}
