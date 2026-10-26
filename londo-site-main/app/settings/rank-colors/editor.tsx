"use client";
import {useState} from "react";
import {FAMILY_RANKS} from "@/lib/rank-appearance/catalog";
import {defaultRankColors,type RankColors} from "@/lib/rank-appearance/rules";
import {AccentColorPicker} from "@/components/profile/accent-color-picker";
import {RankLabel} from "@/components/rank-label";
import {normalizeHex} from "@/lib/profile-customization/colors";
import s from "./editor.module.css";
export function RankColorsEditor({initial}:{initial:RankColors}){
 const [saved,setSaved]=useState(initial),[draft,setDraft]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function save(){setBusy(true);setError("");setNotice("");try{const response=await fetch("/api/rank-colors",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)}),data=await response.json();if(!response.ok)throw Error(data.error||"Не удалось сохранить.");setSaved(data.colors);setDraft(data.colors);setNotice("Цвета рангов сохранены.");}catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения.");}finally{setBusy(false);}}
 return <form onSubmit={e=>{e.preventDefault();void save();}}>{error&&<p role="alert" className="mb-4 text-rose-300">{error}</p>}{notice&&<p role="status" className="mb-4 text-teal-200">{notice}</p>}<fieldset disabled={busy} className={s.list}>{FAMILY_RANKS.map(rank=><div className={s.row} key={rank.roleId}><div className={s.identity}><strong>{rank.label}</strong><small>{rank.scopes.length===2?"Общий ранг":rank.scopes[0]}</small></div><div className={s.preview} aria-label={"Предпросмотр "+rank.label}><RankLabel roleId={rank.roleId} colors={draft}>{rank.label}</RankLabel></div><AccentColorPicker aria-label={"Цвет "+rank.label} value={normalizeHex(draft[rank.roleId])} theme="DEFAULT" allowTheme={false} disabled={busy} onChange={value=>{setDraft(current=>({...current,[rank.roleId]:normalizeHex(value)}));setNotice("");}}/></div>)}</fieldset><div className={s.actions}><button className="londo-button px-5 py-3" disabled={busy}>{busy?"Сохранение…":"Сохранить"}</button><button type="button" className="londo-button-ghost px-4 py-3" disabled={busy} onClick={()=>{setDraft(saved);setNotice("");setError("");}}>Сбросить</button><button type="button" className="londo-button-ghost px-4 py-3" disabled={busy} onClick={()=>{setDraft(defaultRankColors());setNotice("Стандартные цвета выбраны. Нажмите «Сохранить».");}}>Вернуть стандартные цвета</button></div></form>;
}
