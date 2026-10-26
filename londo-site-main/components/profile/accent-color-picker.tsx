"use client";
import {useEffect,useId,useRef,useState,type CSSProperties,type PointerEvent} from "react";
import {ACCENT_PRESETS,hexToHsv,hsvToHex,normalizeHex,resolveAccent,type AccentColor,type HSV} from "@/lib/profile-customization/colors";
import styles from "./accent-color-picker.module.css";

type EyeDropperWindow = Window & {EyeDropper?: new()=>{open:()=>Promise<{sRGBHex:string}>}};
type Props={value:AccentColor;theme:string;onChange:(value:AccentColor)=>void;presets?:readonly {label:string;value:string}[];disabled?:boolean;allowTheme?:boolean;"aria-label"?:string};
export function AccentColorPicker({value,theme,onChange,presets=ACCENT_PRESETS,disabled=false,allowTheme=true,"aria-label":label="Акцент"}:Props){
 const id=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),hexInput=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0}),[eyeAvailable,setEyeAvailable]=useState(false),[picking,setPicking]=useState(false);
 const [hexDraft,setHexDraft]=useState<{source:string;text:string}|null>(null),[error,setError]=useState("");
 const color=resolveAccent(theme,value);
 const [lastHSV,setLastHSV]=useState<{hex:string;hsv:HSV}|null>(null);
 const hsv=lastHSV?.hex===color?lastHSV.hsv:hexToHsv(color);
 const hexText=hexDraft?.source===color?hexDraft.text:color;
 const close=(restore=false)=>{setOpen(false);setHexDraft(null);setError("");if(restore)trigger.current?.focus();};
 useEffect(()=>{
  if(!open)return;
  const outside=(e:globalThis.PointerEvent)=>{if(!root.current?.contains(e.target as Node)){setOpen(false);setHexDraft(null);setError("");}};
  const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();setOpen(false);setHexDraft(null);setError("");trigger.current?.focus();}};
  const resize=()=>setOpen(false);
  document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);window.addEventListener("resize",resize);
  hexInput.current?.focus();
  return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);window.removeEventListener("resize",resize);};
 },[open]);
 function toggle(){if(open){close();return;}const rect=trigger.current!.getBoundingClientRect();setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-332)),top:Math.max(12,Math.min(rect.bottom+8,window.innerHeight-465))});setEyeAvailable(typeof (window as EyeDropperWindow).EyeDropper==="function");setOpen(true);}
 function applyHSV(next:HSV){const bounded={h:Math.max(0,Math.min(360,next.h)),s:Math.max(0,Math.min(100,next.s)),v:Math.max(0,Math.min(100,next.v))};const hex=hsvToHex(bounded);setLastHSV({hex,hsv:bounded});setHexDraft(null);setError("");onChange(hex);}
 function applyHex(text:string){try{const hex=normalizeHex(text);setLastHSV(null);setHexDraft({source:hex,text:hex});setError("");onChange(hex);return true;}catch{setError("Введите 6 HEX-символов, например #A80207.");return false;}}
 function point(e:PointerEvent<HTMLDivElement>){const rect=e.currentTarget.getBoundingClientRect();applyHSV({...hsv,s:(e.clientX-rect.left)/rect.width*100,v:100-(e.clientY-rect.top)/rect.height*100});}
 async function eyedrop(){const Picker=(window as EyeDropperWindow).EyeDropper;if(!Picker)return;setPicking(true);try{const result=await new Picker().open();applyHex(result.sRGBHex);}catch{/* Escape/cancellation keeps the current color. */}finally{setPicking(false);}}
 return <div className={styles.root} ref={root} onBlur={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget as Node))close();}}>
  <span className={styles.label} id={`${id}-label`}>{label}</span>
  <button ref={trigger} type="button" disabled={disabled} className={styles.trigger} onClick={toggle} aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-haspopup="dialog" aria-controls={`${id}-picker`}><span className={styles.chip} style={{background:color}}/><span id={`${id}-value`}>{value==="THEME"?`Цвет темы · ${color}`:color}</span><span aria-hidden="true">⌄</span></button>
  {open&&!disabled&&<div className={styles.popover} id={`${id}-picker`} role="dialog" aria-label={label==="Акцент"?"Выбор акцентного цвета":`Выбор: ${label}`} style={{left:position.left,top:position.top} as CSSProperties}>
   <div className={styles.top}><strong>{label==="Акцент"?"Акцент профиля":label}</strong><button type="button" onClick={()=>close(true)} aria-label="Закрыть выбор цвета">×</button></div>
   {allowTheme&&<div className={styles.modes}><button type="button" aria-pressed={value==="THEME"} onClick={()=>{setLastHSV(null);setHexDraft(null);setError("");onChange("THEME");}}>THEME</button><button type="button" aria-pressed={value!=="THEME"} onClick={()=>onChange(normalizeHex(color))}>CUSTOM</button></div>}
   <div className={styles.square} role="group" aria-label="Насыщенность и яркость: используйте ползунки ниже для клавиатуры" style={{backgroundColor:`hsl(${hsv.h} 100% 50%)`}} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);point(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))point(e);}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}><span className={styles.cursor} style={{left:`${hsv.s}%`,top:`${100-hsv.v}%`,background:color}}/></div>
   <label className={styles.slider}>Оттенок<input className={styles.hue} type="range" min="0" max="360" step="1" value={hsv.h} onChange={e=>applyHSV({...hsv,h:Number(e.target.value)})}/></label>
   <div className={styles.sv}><label className={styles.slider}>Насыщенность<input type="range" min="0" max="100" step="1" value={hsv.s} onChange={e=>applyHSV({...hsv,s:Number(e.target.value)})}/></label><label className={styles.slider}>Яркость<input type="range" min="0" max="100" step="1" value={hsv.v} onChange={e=>applyHSV({...hsv,v:Number(e.target.value)})}/></label></div>
   <div className={styles.hexRow}><span className={styles.chip} style={{background:color}} aria-label={`Текущий цвет ${color}`}/><label className={styles.hexLabel}>HEX<input ref={hexInput} value={hexText} maxLength={7} spellCheck={false} autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error?`${id}-error`:undefined} onChange={e=>{const text=e.target.value;setHexDraft({source:color,text});setError("");if(/^#?[0-9a-fA-F]{6}$/.test(text))applyHex(text);}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();applyHex(hexText);}}} onBlur={()=>{if(hexText!==color)applyHex(hexText);}}/></label>{eyeAvailable&&<button type="button" className={styles.eye} onClick={()=>void eyedrop()} disabled={picking} aria-label="Пипетка" title="Выбрать цвет с экрана">⌖</button>}</div>
   {error&&<p className={styles.error} id={`${id}-error`} role="alert">{error}</p>}
   <div className={styles.presets} aria-label="Готовые цвета">{presets.map(p=><button type="button" key={p.label} aria-label={`${p.label} ${p.value}`} title={`${p.label} ${p.value}`} aria-pressed={value!=="THEME"&&color===normalizeHex(p.value)} style={{background:normalizeHex(p.value)}} onClick={()=>applyHex(p.value)}/>)}</div>
  </div>}
 </div>;
}
