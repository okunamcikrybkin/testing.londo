"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
type Item = {id:string;family:string;name:string;description:string|null;price:string;type:string;discordRoleId:string|null;sortOrder:number;isActive:boolean;_count?:{purchases:number}};
type Shop = {family:string;title:string;description:string;closedText:string|null;status:string;discordChannelId:string|null;discordMessageId:string|null;items:Item[];purchaseCount?:number;pendingCount?:number};
type Options = {channels:{id:string;name:string}[];roles:{id:string;name:string}[]};
const button="londo-button-ghost min-h-10 px-4";
const input="mt-2 w-full rounded-xl border border-white/15 bg-neutral-900 p-3 text-white";
const shopStatusLabel=(status:string)=>status==="OPEN"?"Открыт для покупок":"Временно закрыт";
const deliveryLabel=(type:string)=>type==="DISCORD_ROLE"?"Автоматическая выдача роли":"Выдача администратором";
async function request(url:string,body:object,method="POST") { const response=await fetch(url,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)}); const result=await response.json(); if(!response.ok)throw new Error(result.error||result.warning||"Не удалось выполнить действие.");return result; }
export function ShopAction({url,body,label,method="POST"}:{url:string;body:object;label:string;method?:string}) {const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");return <span><button className={button} disabled={busy} onClick={async()=>{setBusy(true);setMessage("");try{const result=await request(url,body,method);setMessage(result.warning||"Готово");router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>{busy?"Обработка…":label}</button>{message&&<span role="status" className="block max-w-lg text-sm text-amber-200">{message}</span>}</span>;}
export function Preview({shop}:{shop:Shop}) {return <section className="rounded-2xl border border-white/10 bg-[#242429] p-5 [overflow-wrap:anywhere]"><p className="text-xs text-muted">Предпросмотр в Discord · {shopStatusLabel(shop.status)}</p><h2 className="mt-3 text-xl font-bold">{shop.title}</h2><p className="my-3 whitespace-pre-wrap">{shop.status==="OPEN"?shop.description:shop.closedText||"Магазин закрыт."}</p>{shop.items.filter(i=>i.isActive).sort((a,b)=>a.sortOrder-b.sortOrder).map(i=><div className="flex items-center justify-between gap-4 border-t border-white/10 py-4" key={i.id}><div className="min-w-0"><p>{i.name}</p><p className="text-amber-200">Цена: {Number(i.price).toLocaleString("ru-RU")} 🪙</p></div><button type="button" disabled className="shrink-0 rounded bg-green-800 px-3 py-2 opacity-70">Купить</button></div>)}</section>;}
export function ShopDashboard({shops}:{shops:Shop[]}) {const family="MEMPHIS";const shop=shops.find(s=>s.family===family)!;return <><div className="mb-6 flex flex-wrap gap-3"><Link className={button} href="/shop/items/new?family=MEMPHIS">Добавить товар</Link><Link className={button} href="/shop/settings?family=MEMPHIS">Настройки</Link><Link className={button} href="/shop/purchases?family=MEMPHIS">История покупок</Link><ShopAction url="/api/shop/refresh" body={{family}} label="Обновить магазин в Discord"/></div><div className="londo-card mb-6 rounded-2xl p-5">{shopStatusLabel(shop.status)} · Канал: {shop.discordChannelId||"не настроен"} · Активных товаров: {shop.items.filter(i=>i.isActive).length} · Покупок: {shop.purchaseCount} · Ожидают выдачи: {shop.pendingCount}</div><div className="grid items-start gap-6 lg:grid-cols-2"><div className="grid gap-4">{shop.items.map(item=><article key={item.id} className="londo-card min-w-0 rounded-2xl p-5 [overflow-wrap:anywhere]"><h2 className="text-xl font-bold">{item.name}</h2><p className="my-2 whitespace-pre-wrap text-muted">{item.description}</p><p>{item.price} 🪙 · {deliveryLabel(item.type)} · {item.isActive?"Опубликован":"Скрыт"}</p><p className="text-sm text-muted">Позиция: {item.sortOrder} · Роль: {item.discordRoleId||"—"} · Покупок: {item._count?.purchases||0}</p><div className="mt-4 flex flex-wrap gap-2"><Link className={button} href={"/shop/items/"+item.id}>Редактировать</Link><ShopAction url={"/api/shop/items/"+item.id} body={{...item,isActive:!item.isActive}} method="PATCH" label={item.isActive?"Скрыть товар":"Опубликовать товар"}/></div></article>)}{!shop.items.length&&<p>Товаров пока нет.</p>}</div><Preview shop={shop}/></div></>;}
export function ShopForm({shops,item,settings=false,initialFamily="MEMPHIS"}:{shops:Shop[];item?:Item;settings?:boolean;initialFamily?:string}) {
 const router=useRouter();
 const formRef=useRef<HTMLFormElement>(null);
 const [family,setFamily]=useState(item?.family||initialFamily);
 const [savedItemId,setSavedItemId]=useState(item?.id);
 const [type,setType]=useState(item?.type||"MANUAL");
 const [options,setOptions]=useState<Options>({channels:[],roles:[]});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [step,setStep]=useState(0);
 const shop=shops.find(s=>s.family===family)!;
 const steps=settings?["Описание магазина","Правила и вид","Публикация"]:["Основное","Цена и тип","Параметры"];
 useEffect(()=>{fetch("/api/shop/options").then(async r=>{if(!r.ok)throw Error("Discord Bot недоступен. Списки ролей и каналов не загружены.");setOptions(await r.json());}).catch(e=>setError(e.message));},[]);
 function validateStep(index:number){const panel=formRef.current?.querySelector<HTMLElement>(`[data-shop-step="${index}"]`);if(!panel)return false;const invalid=Array.from(panel.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>("input,textarea,select")).find(field=>!field.disabled&&!field.checkValidity());if(!invalid)return true;invalid.reportValidity();invalid.focus();return false;}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!validateStep(step))return;
  if(step<2){setError("");setStep(current=>current+1);requestAnimationFrame(()=>formRef.current?.querySelector<HTMLElement>(`[data-shop-heading="${step+1}"]`)?.focus());return;}
  const form=new FormData(event.currentTarget);
  setBusy(true);setError("");
  try{
   const body=settings?{family,title:form.get("title"),description:form.get("description"),closedText:form.get("closedText"),status:form.get("status"),discordChannelId:form.get("discordChannelId")||null}:{family,name:form.get("name"),description:form.get("description"),price:form.get("price"),type,discordRoleId:form.get("discordRoleId")||null,sortOrder:Number(form.get("sortOrder")),isActive:form.get("isActive")==="on"};
   const result=await request(settings?"/api/shop/settings":savedItemId?"/api/shop/items/"+savedItemId:"/api/shop/items",body,settings||savedItemId?"PATCH":"POST");
   if(result.item?.id)setSavedItemId(result.item.id);
   if(result.warning){setError(result.warning);router.refresh();}
   else {router.push("/shop");router.refresh();}
  }catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить изменения.");}
  finally{setBusy(false);}
 }
 return <>{!savedItemId&&<Tabs family={family} onChange={setFamily}/>}
  <form ref={formRef} key={family} noValidate onSubmit={submit} className="londo-card grid max-w-2xl gap-5 rounded-2xl p-6">
   <div className="londo-form-progress" aria-label={`Шаг ${step+1} из ${steps.length}`}>
    <div className="londo-form-progress-copy"><span>Шаг {step+1} из {steps.length}</span><strong>{steps[step]}</strong></div>
    <div className="londo-form-progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step+1}><span style={{transform:`scaleX(${(step+1)/steps.length})`}}/></div>
    <ol>{steps.map((label,index)=><li key={label} className={index===step?"is-current":index<step?"is-complete":""}><span>{index<step?"✓":index+1}</span>{label}</li>)}</ol>
   </div>
   <p className="text-sm text-muted">Семейное направление: <strong className="text-white">{family}</strong></p>
   {settings?<>
    <section data-shop-step="0" hidden={step!==0} aria-labelledby="shop-step-heading-0"><h2 id="shop-step-heading-0" data-shop-heading="0" tabIndex={-1} className="londo-form-step-title">Как будет выглядеть магазин?</h2><p className="londo-form-step-hint">Укажи название и коротко опиши, что участники найдут в магазине.</p><label>Название магазина<input className={input} name="title" required maxLength={100} defaultValue={shop.title}/></label><label>Описание<textarea className={input} name="description" required maxLength={1000} defaultValue={shop.description}/></label></section>
    <section data-shop-step="1" hidden={step!==1} aria-labelledby="shop-step-heading-1"><h2 id="shop-step-heading-1" data-shop-heading="1" tabIndex={-1} className="londo-form-step-title">Правила и состояние</h2><p className="londo-form-step-hint">Подготовь текст на случай закрытия и выбери, доступен ли магазин сейчас.</p><label>Сообщение, когда магазин закрыт<textarea className={input} name="closedText" maxLength={500} defaultValue={shop.closedText||""}/></label><label>Доступность<select className={input} name="status" defaultValue={shop.status}><option value="OPEN">Открыт для покупок</option><option value="CLOSED">Временно закрыт</option></select></label></section>
    <section data-shop-step="2" hidden={step!==2} aria-labelledby="shop-step-heading-2"><h2 id="shop-step-heading-2" data-shop-heading="2" tabIndex={-1} className="londo-form-step-title">Куда публиковать?</h2><p className="londo-form-step-hint">Выбери канал Discord. Идентификатор публикации можно только посмотреть.</p><label>Канал Discord<select className={input} name="discordChannelId" defaultValue={shop.discordChannelId||""}><option value="">Не настроен</option>{shop.discordChannelId&&!options.channels.some(c=>c.id===shop.discordChannelId)&&<option value={shop.discordChannelId} disabled>Текущий канал недоступен</option>}{options.channels.map(c=><option key={c.id} value={c.id}>#{c.name}</option>)}</select></label><label>Публикация Discord<input className={input} readOnly value={shop.discordMessageId||"Ещё не опубликована"}/></label></section>
   </>:<>
    <section data-shop-step="0" hidden={step!==0} aria-labelledby="shop-step-heading-0"><h2 id="shop-step-heading-0" data-shop-heading="0" tabIndex={-1} className="londo-form-step-title">Расскажи о товаре</h2><p className="londo-form-step-hint">Название и описание будут видны участникам в магазине.</p><label>Название<input className={input} name="name" required maxLength={100} defaultValue={item?.name}/></label><label>Описание<textarea className={input} name="description" maxLength={1000} defaultValue={item?.description||""}/></label></section>
    <section data-shop-step="1" hidden={step!==1} aria-labelledby="shop-step-heading-1"><h2 id="shop-step-heading-1" data-shop-heading="1" tabIndex={-1} className="londo-form-step-title">Цена и способ получения</h2><p className="londo-form-step-hint">Выбери стоимость и способ выдачи товара.</p><label>Цена, монеты<input className={input} name="price" type="number" min="0" max="1000000000" step="0.0001" required defaultValue={item?.price||"0"}/></label><label>Способ получения<select className={input} value={type} onChange={e=>setType(e.target.value)}><option value="MANUAL">Вручную администратором</option><option value="DISCORD_ROLE">Автоматически — роль Discord</option></select></label>{type==="DISCORD_ROLE"&&<label>Роль Discord<select className={input} name="discordRoleId" required defaultValue={item?.discordRoleId||""}><option value="">Выберите роль</option>{options.roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}</section>
    <section data-shop-step="2" hidden={step!==2} aria-labelledby="shop-step-heading-2"><h2 id="shop-step-heading-2" data-shop-heading="2" tabIndex={-1} className="londo-form-step-title">Порядок и публикация</h2><p className="londo-form-step-hint">Настрой порядок в списке и реши, показывать ли товар сразу.</p><label>Позиция в списке<input className={input} name="sortOrder" type="number" min="0" max="2147483647" step="1" defaultValue={item?.sortOrder||0}/></label><label className="flex items-center gap-3"><input name="isActive" type="checkbox" defaultChecked={item?.isActive??true}/> Показывать товар участникам</label></section>
   </>}
   {error&&<p role="alert" className="text-amber-200">{error}</p>}
   <div className="londo-form-actions">{step>0&&<button type="button" disabled={busy} className="londo-button-ghost px-4" onClick={()=>{setError("");setStep(current=>current-1);}}>Назад</button>}<button disabled={busy} className="londo-button px-4 py-3">{busy?"Сохранение…":step<2?"Продолжить":settings?"Сохранить настройки":"Сохранить товар"}</button></div>
   <Link href="/shop">Вернуться в магазин</Link>
  </form>
  {settings&&<div className="mt-6 max-w-2xl"><Preview shop={shop}/></div>}
 </>;
}
