import Link from "next/link";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageGiveaways } from "@/lib/giveaways/access";
import { listGiveaways } from "@/lib/giveaways/data";
import { FamilySettingsLayout } from "@/components/family-settings-layout";

const statusLabels: Record<string, string> = { DRAFT: "Черновик", SCHEDULED: "Запланирован", ACTIVE: "Активен", ENDED: "Завершён", CANCELLED: "Отменён" };
export default async function GiveawaysPage() {
  const user = await getCurrentUser();
  if (!user || !canManageGiveaways(user)) return <div className="londo-page min-h-screen"><Header user={user} /><main className="mx-auto max-w-2xl px-4 py-20"><section className="londo-card rounded-[2rem] p-8 text-center"><p className="londo-eyebrow">Розыгрыши</p><h1 className="mt-3 text-3xl font-bold">Доступ ограничен</h1><p className="mt-3 text-muted">Управлять розыгрышами может команда сообщества. Если тебе нужен доступ, обратись к администратору.</p></section></main></div>;
  const giveaways = await listGiveaways();
  return (
    <div className="londo-page min-h-screen">
      <Header user={user} />
      <FamilySettingsLayout access={user.effectiveAccess} pathname="/giveaways" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="londo-eyebrow">Инструменты сообщества</p>
            <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Розыгрыши</h1>
            <p className="mt-3 text-muted">Здесь можно создать розыгрыш и отследить его ход.</p>
          </div>
          <Link href="/giveaways/new" className="londo-button h-11 px-5">Создать розыгрыш</Link>
        </div>
        <section className="mt-8" aria-label="Список розыгрышей">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Все розыгрыши</h2>
            <span className="text-sm text-muted">{giveaways.length}</span>
          </div>
          {giveaways.length === 0 ? (
            <div className="londo-card rounded-3xl p-8 sm:p-10">
              <h3 className="text-xl font-semibold text-white">Пока нет розыгрышей</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">Создайте первый — после этого он появится здесь, и вы сможете открыть его настройки и результаты.</p>
              <Link href="/giveaways/new" className="londo-button mt-5 inline-flex px-5 py-3">Создать первый розыгрыш</Link>
            </div>
          ) : (
            <ul className="grid gap-3">
              {giveaways.map((giveaway) => (
                <li key={giveaway.id}>
                  <Link
                    href={`/giveaways/${giveaway.id}`}
                    className="londo-card group grid gap-5 rounded-3xl p-5 transition hover:border-white/20 hover:bg-white/[.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-lg font-semibold text-white">{giveaway.prize}</h3>
                        <span className="londo-badge shrink-0 px-3 py-1">{statusLabels[giveaway.status]}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted">{giveaway.family} · {giveaway.participants.length} участников</p>
                      <p className="mt-1 break-all text-xs text-muted">Канал Discord · {giveaway.discordChannelId}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4 sm:justify-end sm:border-0 sm:pt-0">
                      <div className="sm:text-right">
                        <p className="text-xs text-muted">Окончание</p>
                        <p className="mt-1 text-sm text-white">{giveaway.endsAt.toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})} (МСК)</p>
                      </div>
                      <span className="text-lg text-muted transition group-hover:translate-x-1 group-hover:text-white" aria-hidden="true">→</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
