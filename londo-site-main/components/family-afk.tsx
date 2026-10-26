import Link from "next/link";
import type { Family } from "@prisma/client";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { AfkActions } from "@/components/afk-actions";
import { getAfkStaffUser } from "@/lib/afk/access";
import { loadAfkPage } from "@/lib/afk/service";
const afkStatusLabels: Record<string, string> = {
  PENDING: "На рассмотрении",
  APPROVING: "Оформляется",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
  CANCELLED: "Отменено",
  ENDED: "Завершено",
};
const date = (value: Date | null) => value ? value.toLocaleString("ru-RU", { timeZone: "Europe/Berlin" }) : "—";

export async function FamilyAfk({ family, query }: { family: Family; query: { tab?: string; status?: string; user?: string } }) {
  const user = await getAfkStaffUser(family);
  if (!user) redirect("/dashboard");

  const tab = query.tab === "active" || query.tab === "history" ? query.tab : "pending";
  const { applications: apps, readAt } = await loadAfkPage(family, tab, query.user?.slice(0, 100), query.status);
  const base = `/${family.toLowerCase()}/afk`;

  return (
    <div className="londo-page min-h-screen">
      <Header user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={`/${family.toLowerCase()}`} className="londo-button-ghost h-10 items-center px-4">
          ← {family}
        </Link>
        <p className="text-sm text-muted">Панель рекрута / {family} / Отпуск</p>
        </div>
        <section className="londo-card mt-5 rounded-[2rem] p-6 sm:p-8">
          <p className="londo-eyebrow">{family}</p>
          <h1 className="londo-admin-title mt-2">Отпуск</h1>
          <p className="londo-admin-description mt-2">Заявки и активные отпуска семьи. Время: Europe/Berlin.</p>
          <nav className="my-6 flex gap-2 border-b border-white/10" aria-label="Статусы отпусков">
            {[["pending", "Ожидают"], ["active", "Активные"], ["history", "История"]].map(([key, label]) => (
              <Link
                key={key}
                aria-current={tab === key ? "page" : undefined}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition ${tab === key ? "border-white text-white" : "border-transparent text-muted hover:text-white"}`}
                href={`${base}?tab=${key}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <form className="mb-6 flex flex-wrap gap-3">
            <input type="hidden" name="tab" value={tab} />
            <input
              aria-label="Пользователь"
              className="min-w-0 rounded-xl bg-neutral-900 p-3"
              name="user"
              maxLength={100}
              placeholder="Ник / Discord ID"
              defaultValue={query.user}
            />
            {tab === "history" && (
              <select className="rounded-xl bg-neutral-900 p-3" name="status" defaultValue={query.status || ""}>
                <option value="">Все статусы</option>
                {["REJECTED", "CANCELLED", "ENDED"].map(status => <option key={status} value={status}>{afkStatusLabels[status]}</option>)}
              </select>
            )}
            <button className="londo-button-ghost px-4 py-2">Найти</button>
          </form>
          <div className="grid gap-4">
            {!apps.length && (
              <p className="rounded-2xl border border-dashed border-white/20 p-10 text-center text-muted">Записей нет.</p>
            )}
            {apps.map(app => (
              <article key={app.id} className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-5 [overflow-wrap:anywhere]">
                <div className="flex flex-wrap justify-between gap-3">
                  <h2 className="text-xl font-bold">{app.identity.gameNickname || app.identity.displayName}</h2>
                  <span className="londo-badge px-3 py-1">
                    {app.session?.status === "ENDING" ? "Завершается" : tab === "active" && app.status === "APPROVED" ? "Активен" : afkStatusLabels[app.status] || app.status}
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                  {app.identity.displayName} · Discord {app.discordUserId} · Static ID {app.identity.staticId || "—"}
                </p>
                <p className="my-4 whitespace-pre-wrap">{app.reason}</p>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Подано</dt><dd>{date(app.createdAt)}</dd></div>
                  <div>
                    <dt className="text-muted">Запрошено</dt>
                    <dd>
                      {date(app.requestedStartAt)} — {date(app.requestedEndAt)} (
                      {Math.round((+app.requestedEndAt - +app.requestedStartAt) / 60000)} мин)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Рассмотрел</dt>
                    <dd>{app.reviewer?.displayName || app.reviewedByDiscordId || "—"} · {date(app.reviewedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Одобрено / начало</dt>
                    <dd>{date(app.approvedAt)} / {date(app.session?.startAt || null)}</dd>
                  </div>
                  {tab === "active" && (
                    <div>
                      <dt className="text-muted">Осталось на момент загрузки</dt>
                      <dd>{Math.max(0, Math.ceil((+app.requestedEndAt - readAt) / 60000))} мин</dd>
                    </div>
                  )}
                  {app.endedAt && <div><dt className="text-muted">Завершено</dt><dd>{date(app.endedAt)}</dd></div>}
                </dl>
                {app.rejectionReason && <p className="mt-3 text-rose-200">Причина отказа: {app.rejectionReason}</p>}
                {app.session?.lastError && <p className="mt-3 text-amber-200">{app.session.lastError}</p>}
                {(app.status === "PENDING" || app.status === "APPROVED") && (
                  <AfkActions family={family} id={app.id} active={app.status === "APPROVED"} />
                )}
              </article>
            ))}
          </div>
          {apps.length === 300 && <p className="mt-4 text-muted">Показаны 300 последних записей. Уточните фильтр.</p>}
        </section>
      </main>
    </div>
  );
}
