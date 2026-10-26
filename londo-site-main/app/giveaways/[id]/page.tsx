import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/header";
import { GiveawayActions } from "@/components/giveaways/giveaway-actions";
import { GiveawayForm } from "@/components/giveaways/giveaway-form";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageGiveaways } from "@/lib/giveaways/access";
import { getGiveaway } from "@/lib/giveaways/data";
import { FamilySettingsLayout } from "@/components/family-settings-layout";

const statusLabels: Record<string, string> = { DRAFT: "Черновик", SCHEDULED: "Запланирован", ACTIVE: "Активен", ENDED: "Завершён", CANCELLED: "Отменён" };
export default async function GiveawayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user || !canManageGiveaways(user)) redirect("/giveaways");
  const giveaway = await getGiveaway((await params).id); if (!giveaway) notFound();
  const currentWinners = giveaway.winners.filter((winner) => !winner.isRerolled);
  return <div className="londo-page min-h-screen overflow-x-hidden"><Header user={user} /><FamilySettingsLayout access={user.effectiveAccess} pathname="/giveaways/[id]"/><main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6"><Link href="/giveaways" className="text-sm text-muted hover:text-white">← К списку розыгрышей</Link><div className="mt-5 flex flex-wrap items-start justify-between gap-5"><div className="min-w-0"><p className="londo-eyebrow">{giveaway.family}</p><h1 className="mt-2 break-words text-3xl font-bold text-white [overflow-wrap:anywhere] sm:text-4xl">{giveaway.prize}</h1><p className="mt-3 break-words text-muted [overflow-wrap:anywhere]">{giveaway.description}</p></div><span className="londo-badge shrink-0 px-3 py-1">{statusLabels[giveaway.status]}</span></div>
    <section className="londo-card mt-8 rounded-[2rem] p-5 sm:p-7"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted">Участников</p><p className="mt-1 text-2xl font-bold">{giveaway.participants.length}</p></div><div><p className="text-xs text-muted">Победителей</p><p className="mt-1 text-2xl font-bold">{giveaway.winnerCount}</p></div><div><p className="text-xs text-muted">Канал</p><p className="mt-1 break-all text-sm text-white">{giveaway.discordChannelId}</p></div><div><p className="text-xs text-muted">Окончание</p><p className="mt-1 text-sm text-white">{giveaway.endsAt.toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})} (МСК)</p></div></div><h2 className="mt-7 text-lg font-bold">Управление</h2><GiveawayActions id={giveaway.id} status={giveaway.status} winners={giveaway.winners} /></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="londo-card rounded-[2rem] p-6"><h2 className="text-lg font-bold">Победители</h2>{currentWinners.length ? <ol className="mt-4 grid gap-2">{currentWinners.map((winner) => <li key={winner.id} className="rounded-xl bg-white/[.04] px-3 py-2 text-sm">#{winner.position} · <span className="font-mono">{winner.discordUserId}</span></li>)}</ol> : <p className="mt-3 text-sm text-muted">Победители появятся после завершения.</p>}</section><section className="londo-card rounded-[2rem] p-6"><h2 className="text-lg font-bold">История</h2>{giveaway.drawEvents.length ? <ul className="mt-4 grid gap-2">{giveaway.drawEvents.map((event) => <li key={event.id} className="text-sm text-muted">{event.action} · {event.createdAt.toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})} (МСК)</li>)}</ul> : <p className="mt-3 text-sm text-muted">История действий появится после запуска.</p>}</section></div>
    {["DRAFT", "SCHEDULED"].includes(giveaway.status) ? <section className="mt-6"><h2 className="mb-4 text-xl font-bold">Редактирование</h2><GiveawayForm initial={{ description: giveaway.description, discordChannelId: giveaway.discordChannelId, endsAt: giveaway.endsAt.toISOString(), family: giveaway.family, imageUrl: giveaway.imageUrl, mentionRoleId: giveaway.mentionRoleId, prize: giveaway.prize, requiredRoleId: giveaway.requiredRoleId, winnerCount: giveaway.winnerCount }} /></section> : null}
  </main></div>;
}
