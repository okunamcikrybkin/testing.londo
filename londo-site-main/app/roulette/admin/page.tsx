import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/roulette/rules";
import { serialize } from "@/lib/roulette/data";
import { SettingsForm, PrizeActions } from "./forms";
import type { RoulettePrizeType } from "@prisma/client";

const prizeTypeLabels: Record<RoulettePrizeType, string> = {
  COINS: "Монеты",
  DISCORD_ROLE: "Роль Discord",
  MANUAL: "Награда от команды",
  NOTHING: "Без выигрыша",
};

export default async function Page() {
  requireAdmin(await getCurrentUser());
  const [settings,prizes] = await Promise.all([prisma.rouletteSettings.upsert({where:{id:"global"},create:{id:"global",isEnabled:true,paidSpinPrice:25,freeSpinCooldownHours:24},update:{}}),prisma.roulettePrize.findMany({where:{deletedAt:null},orderBy:[{sortOrder:"asc"},{id:"asc"}]})]);
  const activePrizes = prizes.filter(p=>p.isActive);
  const totalWeight = activePrizes.reduce((sum,p)=>sum+p.weight,0);
  return <>
    <header className="mb-8 max-w-3xl">
      <p className="londo-eyebrow">Настройки колеса</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Управление рулеткой</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Задайте правила участия и выберите, какие награды будут доступны.</p>
    </header>
    <section className="londo-card mb-10 rounded-3xl p-5 sm:p-7" aria-labelledby="roulette-settings-title">
      <div className="mb-5">
        <h2 id="roulette-settings-title" className="text-xl font-semibold text-white">Правила участия</h2>
        <p className="mt-1 text-sm text-muted">Изменения применятся к следующим вращениям.</p>
      </div>
      <SettingsForm settings={serialize(settings)}/>
    </section>
    <section aria-labelledby="roulette-prizes-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="roulette-prizes-title" className="text-2xl font-semibold text-white">Награды</h2>
          <p className="mt-1 text-sm text-muted">{activePrizes.length} включено · {prizes.length} всего</p>
        </div>
        <Link href="/roulette/admin/prizes/new" className="londo-button px-5 py-3">Добавить награду</Link>
      </div>
      <p className="mb-5 max-w-3xl text-sm leading-6 text-muted">Вероятность считается по весу каждой включённой награды. Чем выше вес, тем больше шанс. Максимум — 24 активные награды; размер секторов на колесе при этом остаётся одинаковым.</p>
      {prizes.length ? <ul className="grid gap-3 sm:grid-cols-2">
        {prizes.map(p=>{
          const chance=p.isActive&&totalWeight?(p.weight/totalWeight*100):0;
          return <li key={p.id}>
            <article className="londo-card flex h-full min-w-0 flex-col rounded-3xl p-5 transition hover:border-white/20">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold text-white">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted">{prizeTypeLabels[p.type]}</p>
                </div>
                <span className={`londo-status-badge shrink-0 ${p.isActive?"":"opacity-60"}`}>{p.isActive?"Включена":"Выключена"}</span>
              </div>
              {p.description&&<p className="mt-4 break-words text-sm leading-6 text-muted">{p.description}</p>}
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
                <div><dt className="text-xs text-muted">Шанс</dt><dd className="mt-1 font-semibold text-white">{chance.toFixed(2)}%</dd></div>
                <div><dt className="text-xs text-muted">Вес</dt><dd className="mt-1 font-semibold text-white">{p.weight}</dd></div>
              </dl>
              <PrizeActions prize={serialize(p)}/>
            </article>
          </li>;
        })}
      </ul> : <div className="londo-card rounded-3xl p-7 sm:p-8">
        <h3 className="text-lg font-semibold text-white">Наград пока нет</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Добавьте хотя бы одну награду — после этого участники смогут крутить колесо.</p>
        <Link href="/roulette/admin/prizes/new" className="londo-button mt-5 inline-flex px-5 py-3">Добавить первую награду</Link>
      </div>}
    </section>
  </>;
}
