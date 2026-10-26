import {resolveAccent} from "./colors";

/** Keep the exact chosen fill. Low-luminance names get a narrow neutral edge. */
export function profileNameStyle(accent: string | null | undefined) {
 const color=resolveAccent("DEFAULT",accent ?? "THEME");
 const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const luminance=channels.reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i],0);
 return {color,textShadow:luminance<.12?".6px 0 #b7b3bf, -.6px 0 #b7b3bf, 0 .6px #b7b3bf, 0 -.6px #b7b3bf":"none"};
}
