import {normalizeHex,PROFILE_COLORS} from "./colors";

export const FRAME_STYLES=["NONE","SOLID","GLOW","DOUBLE","NEON"] as const;
export const LEGACY_FRAMES=["RED_RING","BLUE_RING","PURPLE_RING","GOLD_RING"] as const;
export const FRAMES=[...FRAME_STYLES,...LEGACY_FRAMES] as const;
export type FrameStyle=typeof FRAME_STYLES[number];
export type AvatarFrame=typeof FRAMES[number];
export const DEFAULT_FRAME_COLOR=PROFILE_COLORS.TEAL as `#${string}`;
export const LEGACY_FRAME_COLORS:Record<string,`#${string}`>={RED_RING:"#EE7881",BLUE_RING:"#79A9F5",PURPLE_RING:"#B68CF2",GOLD_RING:"#E4BD6A"};

/** Reads legacy presets without rewriting existing rows or changing their colors. */
export function normalizeFrame(frame:unknown,color:unknown){
 if(typeof frame!=="string"||!FRAMES.includes(frame as AvatarFrame))throw Error("Выберите доступную рамку аватара.");
 let avatarFrameColor:`#${string}`|null=null;
 if(color!==undefined&&color!==null){
  if(typeof color!=="string"||!/^#[0-9a-fA-F]{6}$/.test(color))throw Error("Цвет рамки: #RRGGBB.");
  avatarFrameColor=normalizeHex(color);
 }
 const legacy=LEGACY_FRAME_COLORS[frame];
 return {avatarFrame:(legacy?"SOLID":frame) as FrameStyle,avatarFrameColor:avatarFrameColor??legacy??null};
}
export function framePresentation(frame:AvatarFrame,color?:string|null){
 const normalized=normalizeFrame(frame,color);
 return {style:normalized.avatarFrame,color:normalized.avatarFrameColor??DEFAULT_FRAME_COLOR};
}
