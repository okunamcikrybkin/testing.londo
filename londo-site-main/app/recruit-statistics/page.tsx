import Link from "next/link";
import { Header } from "@/components/header";
import { getFeatureUser } from "@/lib/permissions/guards";
import { getRecruiterStats } from "@/lib/recruiter-stats/data";

export const dynamic = "force-dynamic";

export default async function RecruitStatisticsPage() {
  const user = await getFeatureUser("recruitStatistics");
  if (!user) return null;
  const stats = await getRecruiterStats();
  const total = stats.reduce((sum, item) => sum + item.total, 0);
  const leaders = stats.slice(0, 3);
  return <div className="londo-page min-h-screen">
    <Header user={user} />
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="londo-admin-heading">
        <p className="londo-admin-eyebrow">Панель администратора · Команда</p>
        <h1 className="londo-admin-title">Статистика рекрутов</h1>
        <p className="londo-admin-description">Сколько заявок обработал каждый рекрутер и какие направления он закрывает.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="londo-ui-surface p-5"><p className="londo-ui-eyebrow">ВСЕГО РЕШЕНИЙ</p><strong className="mt-2 block text-3xl text-white">{total}</strong></div>
        <div className="londo-ui-surface p-5"><p className="londo-ui-eyebrow">РЕКРУТОВ В РЕЙТИНГЕ</p><strong className="mt-2 block text-3xl text-white">{stats.length}</strong></div>
        <div className="londo-ui-surface p-5"><p className="londo-ui-eyebrow">ЛИДЕР</p><strong className="mt-2 block truncate text-xl text-white">{leaders[0]?.displayName ?? "Пока нет данных"}</strong></div>
      </section>

      <section className="londo-ui-surface mt-5 p-5 sm:p-7" aria-labelledby="leaderboard-title">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="londo-ui-eyebrow">РЕЗУЛЬТАТЫ КОМАНДЫ</p><h2 id="leaderboard-title" className="mt-2 text-2xl font-semibold text-white">Лидерборд рекрутов</h2></div><span className="londo-ui-tooltip">Сортировка по количеству решений</span></div>
        {stats.length ? <div className="mt-5 grid gap-3">{stats.map((item, index) => <article key={item.id} className="londo-ui-section p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-sm font-bold text-accent-soft">{index + 1}</span><div className="min-w-0"><h3 className="truncate font-semibold text-white">{item.displayName}</h3><p className="truncate text-xs text-muted">@{item.username} · {item.discordId}</p></div></div><strong className="text-2xl text-white">{item.total}</strong></div><dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5"><div className="londo-ui-section p-3"><dt className="text-xs text-muted">Вступление</dt><dd className="mt-1 font-semibold text-white">{item.applications}</dd></div><div className="londo-ui-section p-3"><dt className="text-xs text-muted">Повышение</dt><dd className="mt-1 font-semibold text-white">{item.promotions}</dd></div><div className="londo-ui-section p-3"><dt className="text-xs text-muted">Отпуск</dt><dd className="mt-1 font-semibold text-white">{item.vacations}</dd></div><div className="londo-ui-section p-3"><dt className="text-xs text-muted">Одобрено</dt><dd className="mt-1 font-semibold text-emerald-200">{item.approved}</dd></div><div className="londo-ui-section p-3"><dt className="text-xs text-muted">Отклонено</dt><dd className="mt-1 font-semibold text-rose-200">{item.rejected}</dd></div></dl></article>)}</div> : <div className="londo-ui-empty mt-5"><strong>Статистики пока нет</strong><span>Она появится после первых рассмотренных заявок.</span></div>}
      </section>
      <Link href="/dashboard" className="londo-ui-button mt-5">Вернуться в панель рекрута</Link>
    </main>
  </div>;
}
