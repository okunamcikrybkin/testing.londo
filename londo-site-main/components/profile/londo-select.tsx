"use client";
import {useEffect,useLayoutEffect,useId,useRef,useState,type CSSProperties,type ReactNode,type KeyboardEvent} from "react";
import {createPortal} from "react-dom";
import s from "./londo-select.module.css";
export type LondoOption<T extends string>={value:T;label:string;description?:string;icon?:ReactNode;disabled?:boolean};
type Props<T extends string>={value:T;options:readonly LondoOption<T>[];onValueChange:(value:T)=>void;disabled?:boolean;placeholder?:string;ariaLabel:string;accent?:string};
export function LondoSelect<T extends string>({value,options,onValueChange,disabled=false,placeholder="Выберите",ariaLabel,accent="#F0CB96"}:Props<T>){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),search=useRef({text:"",time:0});
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState<{left:number;top?:number;bottom?:number;width:number;maxHeight:number}>({left:0,top:0,width:0,maxHeight:280});
 const selected=options.find(o=>o.value===value),safeAccent=/^#[0-9a-f]{6}$/i.test(accent)?accent:"#F0CB96";
 function show(){if(disabled||!options.some(o=>!o.disabled))return;const index=options.findIndex(o=>o.value===value&&!o.disabled);setActive(index>=0?index:options.findIndex(o=>!o.disabled));setOpen(true);}
 function choose(index:number){const option=options[index];if(disabled||!option||option.disabled)return;onValueChange(option.value);setOpen(false);trigger.current?.focus();}
 useLayoutEffect(()=>{
  if(!open||disabled)return;
  function place(){const r=trigger.current?.getBoundingClientRect();if(!r)return;const below=innerHeight-r.bottom-12,above=r.top-12,w=Math.min(r.width,innerWidth-24);if(menu.current)menu.current.style.width=`${w}px`;const desired=Math.min((menu.current?.scrollHeight??278)+2,320);const up=below<desired&&above>below;const height=Math.max(44,Math.min(desired,up?above:below));setPosition({left:Math.max(12,Math.min(r.left,innerWidth-w-12)),top:up?undefined:r.bottom+6,bottom:up?innerHeight-r.top+6:undefined,width:w,maxHeight:height});}
  function outside(e:PointerEvent){if(!trigger.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false);}
  function focus(e:FocusEvent){if(!trigger.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false);}
  function scroll(e:Event){if(!menu.current?.contains(e.target as Node))place();}
  place();window.addEventListener("resize",place);document.addEventListener("scroll",scroll,true);document.addEventListener("pointerdown",outside);document.addEventListener("focusin",focus);
  return()=>{window.removeEventListener("resize",place);document.removeEventListener("scroll",scroll,true);document.removeEventListener("pointerdown",outside);document.removeEventListener("focusin",focus);};
 },[open,disabled]);
 useEffect(()=>{if(open)menu.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({block:"nearest"});},[open,active]);
 function key(e:KeyboardEvent<HTMLButtonElement>){
  if(e.key==="Tab"){setOpen(false);return;}
  if(e.key==="Escape"){if(open){e.preventDefault();e.stopPropagation();setOpen(false);}return;}
  if(e.key==="Enter"||e.key===" "){e.preventDefault();if(open)choose(active);else show();return;}
  if(["ArrowDown","ArrowUp","Home","End"].includes(e.key)){e.preventDefault();if(!open){show();return;}const step=e.key==="ArrowUp"||e.key==="End"?-1:1;let index=e.key==="Home"?-1:e.key==="End"?options.length:active;for(let i=0;i<options.length;i++){index=(index+step+options.length)%options.length;if(!options[index].disabled){setActive(index);break;}}return;}
  if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const now=Date.now();search.current={text:now-search.current.time<700?search.current.text+e.key:e.key,time:now};const index=options.findIndex(o=>!o.disabled&&o.label.toLocaleLowerCase().startsWith(search.current.text.toLocaleLowerCase()));if(index>=0){e.preventDefault();if(!open)show();setActive(index);}}
 }
 return <div className={s.field} style={{"--select-accent":safeAccent} as CSSProperties}><span id={`${id}-label`} className={s.label}>{ariaLabel}</span><button ref={trigger} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open&&!disabled} aria-controls={open&&!disabled?`${id}-menu`:undefined} aria-labelledby={`${id}-label`} aria-activedescendant={open&&!disabled?`${id}-option-${active}`:undefined} disabled={disabled} className={s.trigger} onClick={()=>open?setOpen(false):show()} onKeyDown={key}>{selected?.icon&&<span className={s.icon} aria-hidden="true">{selected.icon}</span>}<span className={s.value}>{selected?.label??placeholder}</span><span className={s.chevron} aria-hidden="true">⌄</span></button>
 {open&&!disabled&&createPortal(<div ref={menu} id={`${id}-menu`} role="listbox" aria-label={ariaLabel} className={s.menu} style={{...position,"--select-accent":safeAccent} as CSSProperties} onPointerDown={e=>e.preventDefault()}>{options.map((o,i)=><div id={`${id}-option-${i}`} key={o.value} role="option" aria-selected={o.value===value} aria-disabled={o.disabled||undefined} data-index={i} data-active={active===i} className={s.option} onPointerMove={()=>{if(!o.disabled)setActive(i);}} onClick={()=>choose(i)}>{o.icon&&<span className={s.icon} aria-hidden="true">{o.icon}</span>}<span className={s.copy}><span>{o.label}</span>{o.description&&<small>{o.description}</small>}</span><span className={s.check} aria-hidden="true">{o.value===value?"✓":""}</span></div>)}</div>,document.body)}
 </div>;
}



