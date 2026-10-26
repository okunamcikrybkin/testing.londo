export const PROFILE_COLORS: Record<string, string> = { DEFAULT:"#31D5BF", RED:"#EE7881", BLUE:"#79A9F5", TEAL:"#31D5BF", PURPLE:"#B68CF2", GOLD:"#E4BD6A", DARK:"#A4A4B9", WHITE:"#ECECF3" };
export type AccentColor = "THEME" | "RED" | "BLUE" | "TEAL" | "PURPLE" | "GOLD" | "WHITE" | `#${string}`;
export const ACCENT_PRESETS = ["RED","BLUE","TEAL","PURPLE","GOLD","WHITE"].map(label => ({label, value:PROFILE_COLORS[label]}));

export function normalizeHex(value: unknown): `#${string}` {
  if (typeof value !== "string" || !/^#?[0-9a-fA-F]{6}$/.test(value)) throw Error("Введите цвет в формате #RRGGBB.");
  return `#${value.replace(/^#/, "").toUpperCase()}`;
}
export function normalizeAccent(value: unknown): AccentColor {
  if (value === "THEME") return value;
  // Backward compatibility: existing named accent presets retain their exact color.
  if (typeof value === "string" && ACCENT_PRESETS.some(p => p.label === value)) return normalizeHex(PROFILE_COLORS[value]);
  return normalizeHex(value);
}
export function resolveAccent(theme: string, accent: string): string {
  if (accent === "THEME") return PROFILE_COLORS[theme] ?? PROFILE_COLORS.DEFAULT;
  try { return normalizeAccent(accent); } catch { return PROFILE_COLORS.DEFAULT; }
}
export type HSV = { h:number; s:number; v:number };
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export function hsvToHex({h,s,v}: HSV): `#${string}` {
  h=((h%360)+360)%360;s=clamp(s,0,100)/100;v=clamp(v,0,100)/100;
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
  const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return `#${rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,"0")).join("").toUpperCase()}`;
}
export function hexToHsv(value: string): HSV {
  const hex=normalizeHex(value),[r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  const h=!d?0:max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);
  return {h:(h+360)%360,s:max?d/max*100:0,v:max*100};
}
