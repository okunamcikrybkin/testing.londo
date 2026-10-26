import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { AccessRefresh } from "@/components/access/access-refresh";
import { StaffAccessAction } from "@/components/access/staff-access-controls";
import { getCurrentUser } from "@/lib/auth/session";
import { accessPageData } from "@/lib/access/view";
import { canRequestScopes, emptyScopes, highestScope, type Scopes } from "@/lib/access/policy";
import { FAMILY_RANKS } from "@/lib/rank-appearance/catalog";
import { ACCESS_LABELS, getEffectiveAccess } from "@/lib/permissions/rbac";
import { FamilyServerIcon } from "@/components/family-server-icon";
import { FamilySettingsLayout } from "@/components/family-settings-layout";
const scopes = (s: Scopes) => {
  const available = [
    s.memphisRole !== "USER" ? { family: "MEMPHIS" as const, label: ACCESS_LABELS[s.memphisRole] } : null,
  ].filter((scope) => scope !== null);
  return available.length
    ? <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">{available.map((scope) => <span key={scope.family} className="inline-flex items-center gap-1.5"><FamilyServerIcon family={scope.family} size="inline" /><span>{scope.label}</span></span>)}</span>
    : "Обычный участник";
};
const familyScopes = (s: Scopes) => {
  const families = [s.memphisRole !== "USER" ? "MEMPHIS" : null].filter((family): family is "MEMPHIS" => Boolean(family));
  return families.length ? <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">{families.map((family) => <span key={family} className="inline-flex items-center gap-1.5"><FamilyServerIcon family={family} size="inline" /><span>{family}</span></span>)}</span> : "Обычный участник";
};
const date = (value: Date) => `${value.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} (МСК)`;
const statusLabels = { PENDING: "На рассмотрении", APPROVED: "Одобрено", REJECTED: "Отклонено", CANCELLED: "Отменено" };

function Account({ user }: { user: { displayName: string; username: string; avatar: string | null } }) {
  return (
    <div className="flex items-center gap-3">
      {user.avatar && <Image src={user.avatar} alt="" width={40} height={40} className="rounded-full" />}
      <div>
        <p className="font-semibold text-white">{user.displayName}</p>
        <p className="text-sm text-muted">@{user.username}</p>
      </div>
    </div>
  );
}

export async function AccessPageContent({ searchParams, managementOnly = false }: { searchParams: Promise<{ tab?: string }>; managementOnly?: boolean }) {
  const user = await getCurrentUser(); if (!user) redirect("/");
  const data = await accessPageData(user), full = getEffectiveAccess(user) === "FULL_ACCESS";
  const eligible = data.snapshot ?? emptyScopes, pending = data.requests.find(r => r.status === "PENDING");
  const mayRequest = !full && !pending && canRequestScopes(data.grant ?? emptyScopes, eligible);
  const ManagementHeading = managementOnly ? "h1" : "h2";
  const requestedTab = (await searchParams).tab;
  const tab = requestedTab === "active" || requestedTab === "history" ? requestedTab : "requests";
  const currentAccessLabel = ACCESS_LABELS[full ? "FULL_ACCESS" : highestScope(eligible)];

  return <div className="londo-page min-h-screen" data-ui-page="access"><Header user={user} /><AccessRefresh />
    {managementOnly && <FamilySettingsLayout access={user.effectiveAccess} pathname="/access/manage" />}
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10 sm:px-6">
      {!managementOnly && <>
        <p className="londo-eyebrow">Семейный доступ</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-5xl">Доступ и заявки</h1>

        <section className="londo-card mt-7 overflow-hidden rounded-[30px] p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-accent-soft">Статус</p>
              <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{full ? "У тебя есть права администратора сайта" : user.effectiveAccess === "USER" ? "Ты участник сообщества LONDO" : `Твой статус: ${ACCESS_LABELS[user.effectiveAccess]}`}</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{full ? "Тебе доступны управление сайтом и основные настройки сообщества." : highestScope(eligible) === "USER" ? "Чтобы вступить в одну из семей, подай заявку. Для этого достаточно быть на Discord-сервере LONDO — специальные роли не нужны." : "Часть возможностей уже доступна. Если понадобится расширить права, отправь запрос — мы покажем, что делать дальше."}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {mayRequest && <StaffAccessAction action="REQUEST" label={data.grant ? "Запросить повышение / семейный доступ" : "Подать заявку на доступ"} />}
                {pending && <><div className="inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200">Заявка на рассмотрении · {ACCESS_LABELS[pending.requestedRole]}</div><StaffAccessAction action="CANCEL" label="Отменить заявку" /></>}
                {!full && highestScope(eligible) === "USER" && <Link href="/apply" className="londo-button-ghost px-5 py-3">Подать заявку в семью</Link>}
                {user.pinRequired && <Link className="londo-button px-5 py-3" href={`/access/pin/${user.pinConfigured ? "verify" : "setup"}`}>{user.pinConfigured ? "Подтвердить код" : "Настроить код"}</Link>}
              </div>
              {data.requests[0]?.status === "REJECTED" && <p className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/8 px-4 py-3 text-sm text-rose-200">Причина отклонения: {data.requests[0].rejectionReason}</p>}
            </div>
            <div className="rounded-[26px] border border-white/10 bg-[#0b0d11] p-5">
              <Account user={{ ...user, avatar: user.avatarUrl }} />
              <dl className="mt-5 space-y-4">
                <div className="flex justify-between gap-3 border-b border-white/8 pb-3"><dt className="text-sm text-muted">Права на сайте</dt><dd><span className="londo-status-badge">{ACCESS_LABELS[user.effectiveAccess]}</span></dd></div>
                <div className="flex justify-between gap-3 border-b border-white/8 pb-3"><dt className="text-sm text-muted">Статус в семье</dt><dd><span className="londo-status-badge">{currentAccessLabel}</span></dd></div>
                <div className="flex justify-between gap-3 border-b border-white/8 pb-3"><dt className="text-sm text-muted">Одобренная семья</dt><dd className="font-semibold text-white">{full ? <span className="inline-flex items-center gap-2"><FamilyServerIcon family="MEMPHIS" size="inline" /></span> : scopes(data.grant ?? emptyScopes)}</dd></div>
                <div className="flex justify-between gap-3 border-b border-white/8 pb-3"><dt className="text-sm text-muted">Семейные роли</dt><dd className="text-right font-semibold text-white">{full ? "Все семьи" : scopes(eligible)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-sm text-muted">Дополнительный код</dt><dd className="font-semibold text-white">{full || user.approvedRole === "USER" ? "Не требуется" : !user.pinConfigured ? "Нужно настроить" : user.pinVerified ? "Подтверждён" : "Ожидает подтверждения"}</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          <article className="londo-card rounded-3xl p-5"><p className="londo-eyebrow">Как начать</p><h3 className="mt-3 text-xl font-semibold text-white">Присоединиться к Discord</h3><p className="mt-3 text-sm leading-7 text-muted">Будь на сервере LONDO — для заявки специальные роли не нужны.</p></article>
          <article className="londo-card rounded-3xl p-5"><p className="londo-eyebrow">Дальше</p><h3 className="mt-3 text-xl font-semibold text-white">Заполнить анкету</h3><p className="mt-3 text-sm leading-7 text-muted">Выбери <FamilyServerIcon family="MEMPHIS" size="inline" /> MEMPHIS и расскажи о себе. Команда сообщества рассмотрит заявку.</p></article>
          <article className="londo-card rounded-3xl p-5"><p className="londo-eyebrow">Защита аккаунта</p><h3 className="mt-3 text-xl font-semibold text-white">Дополнительный код</h3><p className="mt-3 text-sm leading-7 text-muted">Если ты помогаешь управлять сообществом, код защитит важные действия на сайте.</p></article>
        </section>

        <aside className="londo-card mt-5 rounded-3xl border border-white/10 p-5 sm:px-6">
          <p className="londo-eyebrow">Сброс пароля</p>
          <p className="mt-2 text-sm leading-7 text-muted">Чтобы сбросить пароль, напиши в Discord <span className="font-semibold text-white">vaflya2101</span> или <span className="font-semibold text-white">p1wpaw</span>.</p>
        </aside>
      </>}

      {data.manager && managementOnly && <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="londo-admin-eyebrow">Панель администратора</p><ManagementHeading className="londo-admin-title">Управление доступом</ManagementHeading>
            <p className="londo-admin-description">Проверяйте запросы и управляйте выданными правами.</p>
          </div>
          <span className="text-sm text-muted">{tab === "requests" ? `${data.pending.length} на рассмотрении` : tab === "active" ? `${data.active.length} активных` : `${data.reviewed.length + data.history.length} записей`}</span>
        </div>
        <nav aria-label="Разделы управления доступом" className="my-5 flex flex-wrap gap-2">
          {[
            { key: "requests", label: "Запросы", count: data.pending.length },
            { key: "active", label: "Активные доступы", count: data.active.length },
            { key: "history", label: "История", count: data.reviewed.length + data.history.length },
          ].map(({ key, label, count }) => (
            <Link key={key} href={`/access/manage?tab=${key}`} aria-current={tab === key ? "page" : undefined} className={`${tab === key ? "londo-button" : "londo-button-ghost"} inline-flex items-center gap-2 px-4 py-2.5`}>
              {label}<span className="text-xs opacity-70">{count}</span>
            </Link>
          ))}
        </nav>
        <div className="space-y-3">
          {tab === "requests" && (data.pending.length ? data.pending.map(r => {
            const discordRoles = FAMILY_RANKS.filter(rank => Array.isArray(r.discordRoleIds) && r.discordRoleIds.includes(rank.roleId)).map(rank => rank.label);
            return <article key={r.id} className="londo-card rounded-3xl p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <Account user={r.user} />
                <span className="londo-status-badge">На рассмотрении</span>
              </div>
              <dl className="mt-5 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                <div><dt className="text-xs text-muted">Запрашиваемый доступ</dt><dd className="mt-1 font-semibold text-white">{ACCESS_LABELS[r.requestedRole]}</dd></div>
                <div><dt className="text-xs text-muted">Семьи</dt><dd className="mt-1 font-semibold text-white">{scopes(r)}</dd></div>
                <div><dt className="text-xs text-muted">Роли в Discord</dt><dd className="mt-1 text-sm text-white">{discordRoles.join(", ") || "Будут проверены при рассмотрении"}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <p className="text-sm text-muted">Подана {date(r.createdAt)}</p>
                <div className="flex flex-wrap gap-2"><StaffAccessAction action="APPROVE" requestId={r.id} label="Одобрить" /><StaffAccessAction action="REJECT" requestId={r.id} label="Отклонить" /></div>
              </div>
            </article>;
          }) : <div className="londo-card rounded-3xl p-7"><h3 className="font-semibold text-white">Новых запросов нет</h3><p className="mt-2 text-sm text-muted">Когда кто-то отправит запрос на доступ, он появится в этом списке.</p></div>)}
          {tab === "active" && (data.active.length ? data.active.map(g => <article key={g.id} className="londo-card rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><Account user={g.user} /><span className="londo-status-badge">{ACCESS_LABELS[g.role]}</span></div>
            <dl className="mt-5 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-xs text-muted">Семейный доступ</dt><dd className="mt-1 font-semibold text-white">{scopes(g)}</dd></div>
              <div><dt className="text-xs text-muted">Выдан</dt><dd className="mt-1 text-sm text-white">{date(g.grantedAt)}</dd></div>
              <div><dt className="text-xs text-muted">Дополнительный код</dt><dd className="mt-1 text-sm text-white">{g.user.staffAccessCredential?.pinSetAt ? "Настроен" : "Не настроен"}</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <p className="text-sm text-muted">Выдал: {g.grantedByUserId ? data.actors[g.grantedByUserId] ?? "Удалённый аккаунт" : "Ранее выданный доступ"}</p>
              {getEffectiveAccess({ discordId: g.user.discordId, role: g.role }) !== "FULL_ACCESS" && <div className="flex flex-wrap gap-2"><StaffAccessAction action="REVOKE" userId={g.userId} label="Убрать доступ" />{full && <StaffAccessAction action="RESET_PIN" userId={g.userId} label="Сбросить код" />}</div>}
            </div>
          </article>) : <div className="londo-card rounded-3xl p-7"><h3 className="font-semibold text-white">Нет активных расширенных прав</h3><p className="mt-2 text-sm text-muted">Выданные права появятся здесь после одобрения запроса.</p></div>)}
          {tab === "history" && <>{data.reviewed.map(r => <article key={r.id} className="londo-card rounded-3xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><Account user={r.user} /><span className="londo-status-badge">{statusLabels[r.status]}</span></div>
            <p className="mt-4 font-semibold text-white">{ACCESS_LABELS[r.requestedRole]} · {scopes(r)}</p>
            <p className="mt-2 text-sm text-muted">{date(r.reviewedAt ?? r.updatedAt)} · Решил: {r.reviewedByUserId ? data.actors[r.reviewedByUserId] ?? "Удалённый аккаунт" : "—"}</p>
            {r.rejectionReason && <p className="mt-3 rounded-2xl bg-white/[.04] p-3 text-sm text-muted">{r.rejectionReason}</p>}
          </article>)}{data.history.map(g => <article key={g.id} className="londo-card rounded-3xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><Account user={g.user} /><span className="londo-status-badge">Доступ отозван</span></div>
            <p className="mt-4 font-semibold text-white">{ACCESS_LABELS[g.role]} · {familyScopes(g)}</p>
            <p className="mt-2 text-sm text-muted">Выдал: {g.grantedByUserId ? data.actors[g.grantedByUserId] ?? "—" : "Ранее выданный доступ"} · {date(g.grantedAt)}</p>
            <p className="mt-1 text-sm text-muted">Снят: {date(g.revokedAt!)} · {g.revokedByUserId ? data.actors[g.revokedByUserId] ?? "—" : "Проверка ролей Discord"}</p>
            {g.revokeReason && <p className="mt-3 text-sm text-muted">Причина: {g.revokeReason}</p>}
          </article>)}{!data.reviewed.length && !data.history.length && <div className="londo-card rounded-3xl p-7"><h3 className="font-semibold text-white">История пока пуста</h3><p className="mt-2 text-sm text-muted">Решения по запросам и изменения прав будут собраны здесь.</p></div>}</>}
        </div>
      </section>}
      {!data.manager && data.requests.length > 0 && <section className="mt-9"><h2 className="text-xl font-semibold">Мои запросы</h2><div className="mt-4 space-y-3">{data.requests.map(r => <article className="londo-card rounded-xl p-4" key={r.id}><p>{ACCESS_LABELS[r.requestedRole]} · {statusLabels[r.status]} · {scopes(r)}</p><p className="text-sm text-muted">{date(r.createdAt)}</p>{r.rejectionReason && <p className="mt-2">{r.rejectionReason}</p>}</article>)}</div></section>}
    </main></div>;
}
