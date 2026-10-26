import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { historyScope } from "@/lib/roulette/rules";
import { statusLabel, coins } from "@/lib/roulette/types";
import { Action } from "../forms";
const spinTypeLabels = { FREE: "Бесплатное", PAID: "За монеты" };
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const scope=historyScope(await getCurrentUser(),true),p=await searchParams;
  const value=(key:string)=>typeof p[key]==="string"?(p[key] as string).slice(0,100):"";
  const user=value("user"),prize=value("prize"),type=value("type"),status=value("status"),page=Math.max(1,Math.min(10000,Number(value("page"))||1));
  const where:Prisma.RouletteSpinWhereInput={...scope,...(user?{OR:[{discordUserId:{contains:user}},{user:{displayName:{contains:user,mode:"insensitive"}}}]}:{}),...(prize?{prizeId:prize}:{}),...(["FREE","PAID"].includes(type)?{spinType:type as "FREE"|"PAID"}:{}),...(Object.keys(statusLabel).includes(status)?{status:status as Prisma.RouletteSpinWhereInput["status"]}:{})};
  const [spins,prizes,total]=await Promise.all([prisma.rouletteSpin.findMany({where,orderBy:{createdAt:"desc"},take:50,skip:(Math.floor(page)-1)*50,include:{user:{select:{displayName:true}}}}),prisma.roulettePrize.findMany({orderBy:{name:"asc"},select:{id:true,name:true}}),prisma.rouletteSpin.count({where})]);
  const link=(n:number)=>"/roulette/admin/history?"+new URLSearchParams({user,prize,type,status,page:String(n)});
  const hasFilters = Boolean(user || prize || type || status);
  return <>
    <header className="mb-7">
      <p className="londo-eyebrow">Рулетка</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">История вращений</h1>
      <p className="mt-2 text-sm text-muted">Найдите результат по участнику, награде или состоянию выдачи.</p>
    </header>
    <form className="roulette-filters rounded-3xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
      <label>Участник<input name="user" placeholder="Имя или Discord ID" defaultValue={user}/></label>
      <label>Награда<select name="prize" defaultValue={prize}><option value="">Все награды</option>{prizes.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Тип вращения<select name="type" defaultValue={type}><option value="">Все типы</option><option value="FREE">Бесплатное</option><option value="PAID">За монеты</option></select></label>
      <label>Состояние<select name="status" defaultValue={status}><option value="">Все состояния</option>{Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <div className="flex flex-wrap gap-2">
        <button className="londo-button px-4 py-3">Показать результаты</button>
        {hasFilters&&<Link href="/roulette/admin/history" className="londo-button-ghost px-4 py-3">Сбросить</Link>}
      </div>
    </form>
    <div className="mb-4 mt-6 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-white">Результаты</h2>
      <p className="text-sm text-muted">{total} {total===1?"вращение":"вращений"} · время Берлина</p>
    </div>
    {spins.length ? <ul className="grid gap-3">
      {spins.map(s=><li key={s.id}>
        <article className="londo-card rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-semibold text-white">{s.prizeName}</h3>
              <p className="mt-1 text-sm text-muted">{s.user.displayName}</p>
              <p className="mt-1 break-all text-xs text-muted">Discord ID · {s.discordUserId}</p>
            </div>
            <span className="londo-status-badge">{statusLabel[s.status]}</span>
          </div>
          <dl className="mt-5 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-3">
            <div><dt className="text-xs text-muted">Когда</dt><dd className="mt-1 text-sm text-white">{s.createdAt.toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})} (МСК)</dd></div>
            <div><dt className="text-xs text-muted">Участие</dt><dd className="mt-1 text-sm text-white">{spinTypeLabels[s.spinType]}</dd></div>
            <div><dt className="text-xs text-muted">Списано</dt><dd className="mt-1 text-sm text-white">{coins(s.pricePaid.toString())} 🪙</dd></div>
          </dl>
          {s.manualText&&<p className="mt-4 whitespace-pre-wrap rounded-2xl bg-white/[.04] p-4 text-sm leading-6 text-muted"><strong className="mb-1 block text-white">Инструкция по выдаче</strong>{s.manualText}</p>}
          {s.deliveryNote&&<p className="mt-3 text-sm text-muted">{s.deliveryNote}</p>}
          {(s.status==="PENDING_FULFILLMENT"&&s.prizeType==="MANUAL"||s.status==="PENDING_DELIVERY")&&<div className="mt-4 border-t border-white/10 pt-4">
            {s.status==="PENDING_FULFILLMENT"&&s.prizeType==="MANUAL"&&<Action url={"/api/roulette/admin/history/"+s.id} body={{action:"complete"}} label="Отметить выданным"/>}
            {s.status==="PENDING_DELIVERY"&&<Action url={"/api/roulette/admin/history/"+s.id} body={{action:"retry"}} label="Повторить выдачу"/>}
          </div>}
        </article>
      </li>)}
    </ul> : <section className="londo-card rounded-3xl p-7">
      <h3 className="font-semibold text-white">{hasFilters?"Ничего не найдено":"Вращений пока нет"}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{hasFilters?"Измените условия поиска или сбросьте фильтры.":"Здесь появятся результаты, когда участники начнут пользоваться колесом."}</p>
      {hasFilters&&<Link href="/roulette/admin/history" className="londo-button-ghost mt-4 inline-flex px-4 py-2">Сбросить фильтры</Link>}
    </section>}
    <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Страницы истории">
      <span className="text-sm text-muted">Страница {page}</span>
      <div className="flex gap-2">
        {page>1&&<Link className="londo-button-ghost px-4 py-2" href={link(page-1)}>← Назад</Link>}
        {page*50<total&&<Link className="londo-button-ghost px-4 py-2" href={link(page+1)}>Далее →</Link>}
      </div>
    </nav>
  </>;
}
