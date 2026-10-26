"use client";
import { useEffect, useRef, useState } from "react";
import { winningRotation, type WheelPrize } from "@/lib/roulette/wheel";
import { coins, statusLabel, type Spin, type State } from "@/lib/roulette/types";

function sectorPath(index: number, count: number) {
  const a = index * Math.PI * 2 / count - Math.PI / 2, b = (index + 1) * Math.PI * 2 / count - Math.PI / 2;
  return `M 250 250 L ${250 + 236 * Math.cos(a)} ${250 + 236 * Math.sin(a)} A 236 236 0 ${count === 1 ? 1 : 0} 1 ${250 + 236 * Math.cos(b)} ${250 + 236 * Math.sin(b)} Z`;
}
function Wheel({ prizes, rotation, duration, spinning }: { prizes: WheelPrize[]; rotation: number; duration: number; spinning: boolean }) {
  return <div className="roulette-wheel-shell" data-spinning={spinning || undefined}><div className="roulette-pointer" aria-hidden="true"/><svg className="roulette-wheel" viewBox="0 0 500 500" role="img" aria-label="Колесо призов" aria-busy={spinning} style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}ms` }}>
    <defs>
      <linearGradient id="wheel-sector-0" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#693344"/><stop offset="1" stopColor="#321824"/></linearGradient>
      <linearGradient id="wheel-sector-1" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#294c78"/><stop offset="1" stopColor="#15263f"/></linearGradient>
      <linearGradient id="wheel-sector-2" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#514353"/><stop offset="1" stopColor="#29232e"/></linearGradient>
      <linearGradient id="wheel-sector-3" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#315861"/><stop offset="1" stopColor="#192e37"/></linearGradient>
      <radialGradient id="wheel-hub" cx="30%" cy="22%"><stop stopColor="#f6d49e"/><stop offset=".55" stopColor="#c09152"/><stop offset="1" stopColor="#76502a"/></radialGradient>
    </defs>
    <circle cx="250" cy="250" r="247" fill="#111116" stroke="#d9b47b" strokeWidth="3"/>
    <circle cx="250" cy="250" r="241" fill="none" stroke="#fff3" strokeWidth="1"/>
    {!prizes.length && <circle cx="250" cy="250" r="236" fill="#17171e"/>}
    {prizes.map((p,i) => { const angle = (i + .5) * 360 / prizes.length - 90; const fill = `url(#wheel-sector-${i % 4})`; return <g key={p.id}>
      {prizes.length === 1 ? <circle cx="250" cy="250" r="236" fill={fill}/> : <path d={sectorPath(i,prizes.length)} fill={fill} stroke="#ffffff30" strokeWidth="1.5"/>}
      <text transform={`translate(250 250) rotate(${angle})`} x="145" y="4" textAnchor="middle" fill="#f4e5ce" fontSize={prizes.length > 12 ? 9 : prizes.length > 8 ? 11 : 13} fontWeight="600"><title>{p.name}</title>{p.name.length > 16 ? p.name.slice(0,15) + "…" : p.name}</text>
    </g>; })}
  </svg><div className="roulette-hub" aria-hidden="true"><span>L</span><small>LONDO</small></div></div>;
}
export function History({ spins }: { spins: Spin[] }) {
  return <div className="roulette-history">{spins.length ? spins.map(s => <article key={s.id} className="roulette-history-row"><div><strong>{s.prizeName}</strong><p className="text-sm text-muted">{new Date(s.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Berlin" })} · {s.spinType === "FREE" ? "Бесплатное" : `${coins(s.pricePaid)} 🪙`}</p></div><span className="roulette-status">{statusLabel[s.status] || s.status}</span></article>) : <p className="text-muted">Здесь появятся ваши выигрыши.</p>}</div>;
}
export function RoulettePlayer({ initial }: { initial: State }) {
  const [state,setState] = useState(initial), [wheel,setWheel] = useState(initial.prizes);
  const [rotation,setRotation] = useState(0), [duration,setDuration] = useState(5000);
  const [busy,setBusy] = useState(false), [error,setError] = useState(""), [result,setResult] = useState<Spin | null>(null);
  const [now,setNow] = useState(+new Date(initial.serverNow));
  const lock = useRef(false);
  const [pending,setPending] = useState<{ spinType: "FREE" | "PAID"; requestId: string } | null>(null);
  const offset = useRef(0), dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { offset.current = +new Date(initial.serverNow) - Date.now(); const timer = setInterval(() => setNow(Date.now()+offset.current),1000); return () => clearInterval(timer); },[initial.serverNow]);
  useEffect(() => { if (result) dialog.current?.showModal(); },[result]);
  async function refresh() {
    const r = await fetch("/api/roulette", { cache: "no-store" }); if (!r.ok) throw Error("Не удалось обновить баланс и историю. Обновите страницу.");
    const fresh: State = await r.json(); offset.current = +new Date(fresh.serverNow) - Date.now(); setNow(+new Date(fresh.serverNow)); setState(fresh); return fresh;
  }
  async function start(spinType: "FREE" | "PAID") {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    // Retain this key after a network failure: retry retrieves the same committed result.
    const request = pending || { spinType, requestId: crypto.randomUUID() }; setPending(request);
    let uncertain = true;
    try {
      const response = await fetch("/api/roulette/spin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const data = await response.json();
      if (!response.ok) { if (response.status < 500) { setPending(null); uncertain = false; } throw Error(data.error || "Не удалось подтвердить вращение."); }
      const prizes: WheelPrize[] = data.wheel;
      const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 350 : 5000;
      setWheel(prizes); setDuration(ms);
      // Paint the server's catalog snapshot before starting the transition.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      setRotation(current => winningRotation(prizes,data.winningPrizeId,current));
      await new Promise(resolve => setTimeout(resolve,ms+100));
      setPending(null); setResult(data.spin);
      setState(s => ({ ...s, history: [data.spin,...s.history.filter(x => x.id !== data.spin.id)].slice(0,20) }));
      window.dispatchEvent(new Event("londo:coins-changed"));
      try { await refresh(); } catch(e) { setError((e as Error).message); }
    } catch(e) { setError((e as Error).message + (uncertain ? " Повторите запрос: повторного списания не будет." : "")); }
    finally { lock.current = false; setBusy(false); }
  }
  const remaining = Math.max(0, Math.ceil(((state.nextFreeAt ? +new Date(state.nextFreeAt) : 0)-now)/1000));
  const countdown = [Math.floor(remaining/3600),Math.floor(remaining/60)%60,remaining%60].map(v=>String(v).padStart(2,"0")).join(":");
  const unavailable = !state.settings.isEnabled || !state.prizes.length;
  return <><div className="roulette-heading"><div><h1>LONDO <span>Колеса удачи</span></h1><p className="text-muted">Вы можете выиграть внутресемейную валюту, либо внутреигровую валюту</p></div></div>
    <section className="roulette-arena"><div className="roulette-wheel-area"><Wheel prizes={wheel} rotation={rotation} duration={duration} spinning={busy}/><p className="roulette-wheel-caption"></p></div><div className="roulette-controls"><span className="londo-eyebrow">Испытай удачу</span><h2>Крути колесо.</h2><p className="text-muted">Бесплатное вращение — раз в {state.settings.freeSpinCooldownHours} ч. Или крути за монеты, когда захочешь.</p>
      {!state.settings.isEnabled ? <p role="status">Рулетка временно выключена.</p> : !state.prizes.length ? <p role="status">Призы пока не настроены.</p> : null}
      <button disabled={busy || unavailable || remaining > 0 || !!pending} className="londo-button roulette-spin-button" onClick={()=>void start("FREE")}>{busy ? "Вращение…" : "Крутить бесплатно"}</button>
      {remaining > 0 && <p className="roulette-cooldown">Следующее бесплатное вращение через <strong>{countdown}</strong></p>}
      <button disabled={busy || unavailable || !!pending} className="londo-button-ghost roulette-spin-button" onClick={()=>void start("PAID")}>Крутить за {coins(state.settings.paidSpinPrice)} 🪙</button>
      {error && <p role="alert" className="text-amber-200">{error}</p>}{!busy && pending && <button className="londo-button-ghost px-4 py-3" onClick={()=>void start(pending!.spinType)}>Повторить запрос</button>}
      <div className="roulette-last"><span className="text-xs text-muted">ПОСЛЕДНИЙ ВЫИГРЫШ</span><strong>{state.history[0]?.prizeName || "Первый приз ещё впереди"}</strong>{state.history[0] && <span className="text-sm text-muted">{statusLabel[state.history[0].status]}</span>}</div>
    </div></section>
    <section className="mt-10"><h2 className="text-2xl font-semibold">На колесе</h2><div className="roulette-prize-list">{state.prizes.map((p,i)=><span key={p.id}><b>{String(i+1).padStart(2,"0")}</b> {p.name}</span>)}</div></section>
    <section className="mt-10"><h2 className="mb-5 text-2xl font-semibold">Последние выигрыши</h2><History spins={state.history}/></section>
    <dialog ref={dialog} className="roulette-result" onClose={()=>setResult(null)} aria-labelledby="roulette-result-title">{result && <><p className="londo-eyebrow">{result.prizeType === "NOTHING" ? "Вращение завершено" : "Поздравляем!"}</p><h2 id="roulette-result-title">{result.prizeName}</h2>{result.prizeType === "COINS" && <p className="text-3xl text-accent">+{coins(result.coinAmount || "0")} 🪙</p>}<p>{result.deliveryNote || statusLabel[result.status]}</p>{result.manualText && <p className="whitespace-pre-wrap">{result.manualText}</p>}<button autoFocus className="londo-button mt-6 px-8 py-3" onClick={()=>dialog.current?.close()}>Отлично</button></>}</dialog>
  </>;
}
