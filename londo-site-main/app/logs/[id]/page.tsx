import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";
import { logActionLabel, categoryLabel } from "@/lib/logs/contract";
import { getLogDetail, safeMetadataEntries } from "@/lib/logs/data";
import { canUseFeature } from "@/lib/permissions/features";
import { FamilyServerIcon } from "@/components/family-server-icon";

type Props = { params: Promise<{ id: string }> };
const formatDate = (date: Date) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "full", timeStyle: "medium" }).format(date);
const resultLabel = (result: string | null) => result === "SUCCESS" ? "Успешно" : result === "FAILURE" ? "Ошибка" : result === "PENDING" ? "Ожидает" : result === "INFO" ? "Информация" : result;
export default async function LogDetailPage({ params }: Props) {
  const user = await getCurrentUser(); if (!user) redirect("/");
  const event = await getLogDetail((await params).id); if (!event) notFound();
  if (!canUseFeature(user.effectiveAccess, event.source === "audit" ? "logs" : "discordLogs")) redirect("/dashboard");
  const metadata = safeMetadataEntries(event.metadata);
  const journalHref = event.source === "audit" ? "/logs?source=site" : "/logs?source=discord";
  const journalLabel = event.source === "audit" ? "Журнал сайта" : "Журнал Discord";
  return <div className="londo-page min-h-screen"><Header user={user} /><main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6"><Link href={journalHref} className="text-sm text-muted transition hover:text-white">← {journalLabel}</Link><section className="londo-card mt-5 rounded-[2rem] p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="londo-eyebrow">{categoryLabel(event.category)}</p><h1 className="mt-3 text-2xl font-bold text-white">{event.summary}</h1></div><span className="londo-badge px-3 py-1" aria-label={event.family ?? "Общее"} title={event.family ?? "Общее"}>{event.family ? <FamilyServerIcon family={event.family} size="inline" /> : "Общее"}</span></div><dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2"><div className="logs-detail"><dt>Время</dt><dd>{formatDate(event.createdAt)}</dd></div><div className="logs-detail"><dt>Действие</dt><dd>{logActionLabel(event.action)}</dd></div><div className="logs-detail"><dt>Кто выполнил</dt><dd>{event.actor ?? "Система"}</dd></div><div className="logs-detail"><dt>Участник</dt><dd>{event.target ?? "Не указан"}</dd></div>{event.result ? <div className="logs-detail"><dt>Результат</dt><dd>{resultLabel(event.result)}</dd></div> : null}</dl>{metadata.length ? <div className="mt-7 border-t border-white/[.08] pt-6"><h2 className="text-sm font-bold text-white">Подробности</h2><dl className="mt-3 grid gap-2">{metadata.map(([key, value]) => <div key={key} className="logs-detail"><dt>{key}</dt><dd className="break-words">{value}</dd></div>)}</dl></div> : null}{user.effectiveAccess === "FULL_ACCESS" ? <details className="mt-7 border-t border-white/[.08] pt-5"><summary className="cursor-pointer text-sm font-semibold text-muted hover:text-white">Служебные данные</summary><dl className="mt-3 grid gap-2">{Object.entries(event.technical).map(([key, value]) => <div key={key} className="logs-detail"><dt>{key}</dt><dd className="break-all">{value ?? "Не указано"}</dd></div>)}</dl></details> : null}</section></main></div>;
}
