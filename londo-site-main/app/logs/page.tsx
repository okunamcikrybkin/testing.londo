import Link from "next/link";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";
import { logActionLabel, categoryLabel, LOG_CATEGORIES } from "@/lib/logs/contract";
import { getLogFeed, parseLogFilters } from "@/lib/logs/data";
import { ACCESS_LABELS } from "@/lib/permissions/rbac";
import { canUseFeature } from "@/lib/permissions/features";
import { redirect } from "next/navigation";
import { FamilyServerIcon } from "@/components/family-server-icon";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const formatDate = (date: Date) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
const familyClass = (family: string | null) => family === "MEMPHIS" ? "family-memphis" : "";
const familyLabel = (family: string | null) => family === "MEMPHIS" ? "Memphis" : "Общее";
const familyValue = (family: string | null) => family === "MEMPHIS" ? family : "ALL";
const resultLabel = (result: string | null) => result === "SUCCESS" ? "Успешно" : result === "FAILURE" ? "Ошибка" : result === "PENDING" ? "Ожидает" : result === "INFO" ? "Информация" : result;

export default async function LogsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const params = await searchParams;
  const source = params.source === "discord" ? "discord" : "site";
  const journal = source === "discord" ? "DISCORD" : "SITE";
  if (!canUseFeature(user.effectiveAccess, source === "discord" ? "discordLogs" : "logs")) redirect("/dashboard");
  const parsedFilters = parseLogFilters(params);
  const sourceSpecificCategory = source === "site" ? "MEMBERSHIP" : "ACCESS";
  const invalidCategory = parsedFilters.category === sourceSpecificCategory;
  const filters = invalidCategory ? { ...parsedFilters, category: "ALL" as const } : parsedFilters;
  const feed = await getLogFeed(filters, journal);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (key !== "source" && !(invalidCategory && key === "category") && typeof value === "string" && value) query.set(key, value);
  query.set("source", source);
  const pageHref = (page: number) => { const next = new URLSearchParams(query); next.set("page", String(page)); next.set("size", String(filters.pageSize)); return `/logs?${next}`; };
  const title = source === "site" ? "Журнал сайта" : "Журнал Discord";
  const categories = LOG_CATEGORIES.filter((category) => category !== sourceSpecificCategory);
  const description = source === "site"
    ? "Авторизации и действия пользователей на сайте LONDO."
    : "События Discord-бота и сервера: входы, выходы и другие действия участников.";
  return <div className="londo-page min-h-screen"><Header user={user} /><main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="londo-eyebrow">Аудит LONDO</p><h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{description}</p></div><span className="londo-status-badge w-fit">{ACCESS_LABELS[user.effectiveAccess]}</span></div>
    <nav className="mt-6 flex flex-wrap gap-2" aria-label="Выбор журнала"><Link href="/logs?source=site" aria-current={source === "site" ? "page" : undefined} className={`${source === "site" ? "londo-button" : "londo-button-ghost"} h-10 px-4`}>Сайт</Link><Link href="/logs?source=discord" aria-current={source === "discord" ? "page" : undefined} className={`${source === "discord" ? "londo-button" : "londo-button-ghost"} h-10 px-4`}>Discord-бот</Link></nav>
    <form className="londo-card mt-5 grid gap-3 rounded-[1.5rem] p-4 md:grid-cols-4" method="get"><input type="hidden" name="source" value={source} /><input name="q" defaultValue={filters.q} placeholder="Поиск: ID, имя, действие" className="logs-input md:col-span-2" /><fieldset className="family-filter-options"><legend>Семья</legend><label><input type="radio" name="family" value="ALL" defaultChecked={familyValue(filters.family) === "ALL"} /><span>Все</span></label>{(["MEMPHIS"] as const).map((family) => <label key={family} title={family}><input type="radio" name="family" value={family} defaultChecked={filters.family === family} /><span>{family}</span><FamilyServerIcon family={family} size="inline" /></label>)}</fieldset><select name="category" defaultValue={filters.category} className="logs-input">{categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}</select><input name="actor" defaultValue={filters.actor} placeholder="Актор" className="logs-input" /><input name="target" defaultValue={filters.target} placeholder="Цель / ID" className="logs-input" /><input name="from" type="date" defaultValue={filters.from?.toISOString().slice(0, 10)} className="logs-input" /><input name="to" type="date" defaultValue={filters.to?.toISOString().slice(0, 10)} className="logs-input" /><select name="result" defaultValue={filters.result} className="logs-input"><option value="ALL">Все результаты</option><option value="SUCCESS">Успешно</option><option value="FAILURE">Ошибка</option><option value="PENDING">Ожидание</option><option value="INFO">Информация</option></select><select name="size" defaultValue={filters.pageSize} className="logs-input"><option value="25">25 на странице</option><option value="50">50 на странице</option></select><div className="flex gap-2"><button className="londo-button h-10 px-5" type="submit">Применить</button><Link href={`/logs?source=${source}`} className="londo-button-ghost h-10 px-4">Сбросить</Link></div></form>
    <section className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/[.09] bg-[#0d0d11]"><div className="hidden grid-cols-[10rem_1fr_9rem_10rem] gap-4 border-b border-white/[.08] px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted md:grid"><span>Время</span><span>Событие</span><span>Семья</span><span>Кто выполнил</span></div><div>{feed.items.length ? feed.items.map((item) => <Link key={`${item.source}-${item.id}`} href={`/logs/${item.detailId}?source=${source}`} className="logs-row grid gap-2 px-5 py-4 md:grid-cols-[10rem_1fr_9rem_10rem] md:gap-4"><time className="text-xs leading-5 text-muted">{formatDate(item.createdAt)}</time><div><span className="text-sm font-semibold text-white">{item.summary}</span><p className="mt-1 truncate text-xs text-muted">{logActionLabel(item.action)}{item.target ? ` · Участник: ${item.target}` : ""}{item.result ? ` · ${resultLabel(item.result)}` : ""}</p></div><span className={`logs-family ${familyClass(item.family)}`} aria-label={familyLabel(item.family)} title={familyLabel(item.family)}>{item.family ? <><FamilyServerIcon family={item.family} size="inline" /><span>{familyLabel(item.family)}</span></> : "Общее"}</span><span className="truncate text-sm text-muted">{item.actor ?? "Система"}</span></Link>) : <div className="px-5 py-16 text-center text-sm text-muted">По выбранным фильтрам событий пока нет.</div>}</div></section>
    <nav className="mt-6 flex items-center justify-between" aria-label="Страницы логов"><span className="text-sm text-muted">Страница {filters.page}</span><div className="flex gap-2">{feed.hasPreviousPage ? <Link className="londo-button-ghost h-10 px-4" href={pageHref(filters.page - 1)}>Назад</Link> : <span className="londo-button-ghost h-10 cursor-not-allowed px-4 opacity-40">Назад</span>}{feed.hasNextPage ? <Link className="londo-button-ghost h-10 px-4" href={pageHref(filters.page + 1)}>Вперёд</Link> : <span className="londo-button-ghost h-10 cursor-not-allowed px-4 opacity-40">Вперёд</span>}</div></nav>
  </main></div>;
}
