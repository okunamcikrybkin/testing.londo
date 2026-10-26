import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/header";
import { StatusBadge } from "@/components/applications/status-badge";
import { ClaimApplicationLink } from "@/components/applications/claim-application-link";
import { getCurrentUser } from "@/lib/auth/session";
import { canEditFamilyApplication } from "@/lib/applications/edit-policy";
import { listFamilyApplications, type ApplicationTab } from "@/lib/applications/data";
import { familyFromSlug, familyLabel, familySlug } from "@/lib/applications/families";
import { notFound, redirect } from "next/navigation";

const tabs: { label: string; value: ApplicationTab }[] = [
  { label: "Новые", value: "new" },
  { label: "На обзвоне", value: "call" },
  { label: "История", value: "history" },
];

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function FamilyApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ family: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const [{ family: familyParam }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const family = familyFromSlug(familyParam);
  if (!family) {
    notFound();
  }

  if (!canEditFamilyApplication(user, family)) redirect("/access-denied");

  const tab: ApplicationTab = tabParam === "call" || tabParam === "history" ? tabParam : "new";
  const applications = await listFamilyApplications(family, tab);
  const slug = familySlug(family);
  return (
    <div className="londo-page min-h-screen" data-ui-page="applications" data-ui-family={family.toLowerCase()}>
      <Header user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={family === "MEMPHIS" ? "/memphis" : "/phoenix"} className="londo-ui-button"><span aria-hidden="true">←</span> Панель сервера</Link>
          <p className="londo-ui-tooltip">Панель рекрута <span aria-hidden="true">/</span> {familyLabel(family)} <span aria-hidden="true">/</span> Заявки</p>
        </div>
        <section className="londo-ui-surface mt-5 p-5 sm:p-7" aria-labelledby="applications-title">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0"><p className="londo-ui-eyebrow">ЗАЯВКИ · {familyLabel(family)}</p><h1 className="londo-ui-title" id="applications-title">Приём в семью</h1><p className="londo-ui-description">Новые кандидаты и этапы рассмотрения заявок.</p></div>
          <span className="londo-ui-badge">Изолированный поток</span>
        </header>

        <nav className="londo-ui-tabs my-6" aria-label="Статусы заявок">
          {tabs.map((item) => (
            <Link key={item.value} href={`/applications/${slug}?tab=${item.value}`} aria-current={tab === item.value ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        {applications.length === 0 ? (
          <div className="londo-ui-empty"><strong>Заявок пока нет</strong>Новые заявки появятся здесь после отправки через Discord-бота.</div>
        ) : (
          <div className="mt-4 grid gap-3">
            {applications.map((application) => (
              <article key={application.id} className="londo-ui-surface ui-application-row flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  {application.discordAvatar ? <Image src={application.discordAvatar} alt="" width={48} height={48} className="h-12 w-12 rounded-2xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-lg font-semibold">{application.discordDisplayName.slice(0, 1).toUpperCase()}</div>}
                  <div className="min-w-0"><h2 className="truncate font-semibold text-white">{application.discordDisplayName}</h2><p className="truncate text-sm text-muted">@{application.discordUsername} · {formatDate(application.createdAt)}</p><div className="mt-2"><StatusBadge status={application.status} /></div></div>
                </div>
                <ClaimApplicationLink id={application.id} family={slug} href={`/applications/${slug}/${application.id}`} claimed={Boolean(application.claimedByUserId && application.claimedByUserId !== user.id)} owned={application.claimedByUserId === user.id} />
              </article>
            ))}
          </div>
        )}
        </section>
      </main>
    </div>
  );
}
