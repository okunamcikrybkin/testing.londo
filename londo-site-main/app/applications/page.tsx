import Link from "next/link";
import { FamilyServerIcon } from "@/components/family-server-icon";
import { Header } from "@/components/header";
import { canManageApplications } from "@/lib/applications/access";
import { FAMILY_COPY } from "@/lib/applications/families";
import { getFamilyApplicationCounts } from "@/lib/applications/data";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ApplicationsPage() {
  const user = await getCurrentUser();

  if (!user || !canManageApplications(user, "MEMPHIS")) {
    return (
      <div className="londo-page min-h-screen">
        <Header user={user} />
        <main className="mx-auto flex w-full max-w-2xl px-4 py-20 sm:px-6">
          <section className="londo-card w-full rounded-[2rem] p-8 text-center">
            <p className="londo-eyebrow">Заявки в семьи</p>
            <h1 className="mt-4 text-3xl font-semibold text-white">Доступ ограничен</h1>
            <p className="mt-3 leading-7 text-muted">
              Этот раздел доступен только рекрутерам и администрации.
              {user ? " Обратитесь к администратору для получения роли." : " Войдите через Discord, чтобы продолжить."}
            </p>
            <Link href="/" className="londo-button-ghost mt-7 h-11 px-5">
              Вернуться на главную
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const accessibleFamilies = (["MEMPHIS"] as const).filter(family => canManageApplications(user, family));
  const families = await Promise.all(accessibleFamilies.map(async family => ({ family, counts: await getFamilyApplicationCounts(family) })));

  return (
    <div className="londo-page min-h-screen">
      <Header user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <p className="londo-eyebrow">Работа с заявками</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Заявки в семьи</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted">Поток обработки заявок семьи MEMPHIS.</p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {families.map(({ family, counts }) => {
            const copy = FAMILY_COPY[family]!;
            return (
              <article key={family} className={`londo-card londo-card-lift rounded-[2rem] p-6 sm:p-8 ${family === "MEMPHIS" ? "family-memphis" : "family-phoenix"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <FamilyServerIcon family={family} size="large" />
                    <div>
                    <p className="londo-eyebrow">Семья</p>
                    <h2 className="mt-2 text-3xl font-bold text-white">{family}</h2>
                    </div>
                  </div>
                  <span className="londo-badge px-3 py-1">Отдельный поток</span>
                </div>
                <p className="mt-5 min-h-12 leading-6 text-muted">{copy.description}</p>
                <dl className="mt-7 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-black/20 p-4"><dt className="text-xs text-muted">Новые</dt><dd className="mt-1 text-2xl font-semibold text-white">{counts.newCount}</dd></div>
                  <div className="rounded-2xl bg-black/20 p-4"><dt className="text-xs text-muted">На обзвоне</dt><dd className="mt-1 text-2xl font-semibold text-white">{counts.callCount}</dd></div>
                </dl>
                <Link href={`/applications/${copy.slug}`} className={`mt-7 inline-flex h-11 items-center rounded-full px-5 text-sm font-bold transition ${family === "MEMPHIS" ? "family-memphis-button" : "family-phoenix-button"}`}>Открыть заявки</Link>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
