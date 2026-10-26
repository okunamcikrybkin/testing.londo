import Link from "next/link";
import { Header } from "@/components/header";
import { getShopManager } from "@/lib/shop/access";
import { listPurchases } from "@/lib/shop/data";
import { redirect } from "next/navigation";
import { ShopAction } from "../shop-client";
import { FamilyServerIcon } from "@/components/family-server-icon";
import { FamilySettingsLayout } from "@/components/family-settings-layout";
export const dynamic = "force-dynamic";
const statusLabels: Record<string,string> = { PENDING_FULFILLMENT:"Ожидает выдачи", COMPLETED:"Выдано", REFUNDED:"Монеты возвращены" };

export default async function PurchasesPage({searchParams}:{searchParams:Promise<{family?:string;status?:string}>}) {
  const user=await getShopManager();
  if(!user) redirect("/dashboard");
  const filter=await searchParams;
  const family=filter.family==="MEMPHIS"?filter.family:undefined;
  const status=filter.status==="COMPLETED"||filter.status==="REFUNDED"||filter.status==="PENDING_FULFILLMENT"?filter.status:undefined;
  const purchases=await listPurchases({family,status});
  return <div className="londo-page min-h-screen">
    <Header user={user}/>
    <FamilySettingsLayout access={user.effectiveAccess} pathname="/shop/purchases"/>
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/shop" className="londo-button-ghost px-4">← Вернуться в магазин</Link>
      <p className="londo-eyebrow mt-8">Магазин сообщества</p>
      <h1 className="my-3 text-3xl font-bold">История покупок</h1>
      <p className="mb-6 text-sm text-muted">Проверь выдачу товаров и при необходимости помоги участнику.</p>
      <form className="londo-card mb-6 flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <fieldset className="family-filter-options"><legend>Семья</legend><label><input type="radio" name="family" value="" defaultChecked={!family} /><span>Все</span></label><label title="MEMPHIS"><input type="radio" name="family" value="MEMPHIS" defaultChecked={family==="MEMPHIS"} /><FamilyServerIcon family="MEMPHIS" size="inline" /></label></fieldset>
        <label className="grid gap-2 text-sm text-muted">Состояние покупки<select className="min-w-48 rounded bg-neutral-900 p-3" name="status" defaultValue={status||""}><option value="">Все состояния</option><option value="PENDING_FULFILLMENT">Ожидает выдачи</option><option value="COMPLETED">Выдано</option><option value="REFUNDED">Монеты возвращены</option></select></label>
        <button className="londo-button px-5">Показать</button>
      </form>
      <div className="grid gap-4">
        {!purchases.length&&<section className="londo-card rounded-2xl p-8 text-center"><h2 className="text-lg font-semibold">Покупок пока нет</h2><p className="mt-2 text-sm text-muted">Попробуй выбрать другую семью или состояние покупки.</p></section>}
        {purchases.map(p=><article key={p.id} className="londo-card rounded-2xl p-5 [overflow-wrap:anywhere]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted">{p.createdAt.toLocaleString("ru-RU")} · <FamilyServerIcon family={p.family} size="inline" /></p>
            <span className="londo-status-badge">{statusLabels[p.status]??p.status}</span>
          </div>
          <h2 className="my-2 text-xl font-bold">{p.item.name}</h2>
          <p>{p.price.toString()} 🪙 · {p.type==="DISCORD_ROLE"?"Автоматическая выдача роли":"Выдача администратором"}</p>
          {p.fulfilledBy&&<p className="mt-2 text-sm text-muted">Выдал: {p.fulfilledBy.displayName}</p>}
          {p.completedAt&&<p className="mt-1 text-sm text-muted">Дата выдачи: {p.completedAt.toLocaleString("ru-RU")}</p>}
          {p.status==="PENDING_FULFILLMENT"&&p.type==="MANUAL"&&<div className="mt-4 flex flex-wrap gap-3"><ShopAction url={"/api/shop/purchases/"+p.id+"/complete"} body={{}} label="Отметить выданным"/><ShopAction url={"/api/shop/purchases/"+p.id+"/refund"} body={{}} label="Вернуть монеты"/></div>}
        </article>)}
      </div>
    </main>
  </div>;
}
