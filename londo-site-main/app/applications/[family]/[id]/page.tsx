import { CheckDialog } from "@/components/discord-checks/check-dialog";
import { ApplicationEditor } from "@/components/applications/application-editor";
import { ApplicationEditHistory } from "@/components/applications/application-edit-history";
import { canManageApplications } from "@/lib/applications/access";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/header";
import { ApplicationActions } from "@/components/applications/application-actions";
import { ApplicantHistory } from "@/components/applications/applicant-history";
import { ClaimApplicationPrompt } from "@/components/applications/claim-application-prompt";
import { StatusBadge } from "@/components/applications/status-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { canEditFamilyApplication, isEditableApplicationStatus } from "@/lib/applications/edit-policy";
import { parseApplicationAnswers } from "@/lib/applications/answers";
import { getApplicantApplicationHistory, getApplicationAuditTrail, getFamilyApplication } from "@/lib/applications/data";
import { familyFromSlug, familyLabel, familySlug } from "@/lib/applications/families";
import { notFound, redirect } from "next/navigation";

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date) : "—";
}

const auditLabels: Record<string, string> = {
  APPLICATION_EDITED: "Ответы отредактированы",
  APPLICATION_ACCEPTED: "Заявка принята",
  APPLICATION_CALL_STARTED: "Начат обзвон",
  APPLICATION_CREATED: "Создана заявка",
  APPLICATION_DISCORD_CHECK_STARTED: "Начата проверка Discord",
  APPLICATION_REJECTED: "Заявка отклонена",
};

function auditLabel(action: string): string {
  return auditLabels[action] ?? (action.startsWith("APPLICATION_") ? "Выполнено действие по заявке" : "Системное действие");
}

export default async function ApplicationDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ family: string; id: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const [{ family: familyParam, id }, { claim }] = await Promise.all([params, searchParams]);
  const family = familyFromSlug(familyParam);
  if (!family) {
    notFound();
  }

  if (!canEditFamilyApplication(user, family)) redirect("/access-denied");

  const application = await getFamilyApplication(id, family);
  if (!application) {
    notFound();
  }
  const [auditTrail, applicantHistory] = await Promise.all([
    getApplicationAuditTrail(application.id),
    getApplicantApplicationHistory(application.discordUserId, application.id),
  ]);
  const slug = familySlug(family);
  const answers = parseApplicationAnswers(application.answers);

  return (
    <div className="londo-page min-h-screen">
      <Header user={user} />
      {claim === "1" && application.status !== "ACCEPTED" && application.status !== "REJECTED" && !application.claimedByUserId ? <ClaimApplicationPrompt id={application.id} family={slug} /> : null}
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={`/applications/${slug}?tab=${application.status === "NEW" ? "new" : application.status === "CALL" ? "call" : "history"}`} className="londo-ui-button"><span aria-hidden="true">←</span> К заявкам</Link>
          <p className="londo-ui-tooltip">Панель рекрута <span aria-hidden="true">/</span> {familyLabel(family)} <span aria-hidden="true">/</span> Заявки</p>
        </div>
        <section className="londo-ui-surface mt-5 p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {application.discordAvatar ? <Image src={application.discordAvatar} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-2xl object-cover" /> : <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-accent text-2xl font-semibold">{application.discordDisplayName.slice(0, 1).toUpperCase()}</div>}
              <div><div className="londo-ui-eyebrow">{familyLabel(family)}</div><h1 className="londo-ui-title mt-2">{application.discordDisplayName}</h1><p className="londo-ui-description">@{application.discordUsername}</p></div>
            </div>
            <StatusBadge status={application.status} />
          </div>

          <dl className="mt-8 grid gap-3 sm:grid-cols-2"><div className="londo-ui-section p-4"><dt className="text-xs text-muted">Discord ID</dt><dd className="mt-1 break-all text-sm text-white">{application.discordUserId}</dd></div><div className="londo-ui-section p-4"><dt className="text-xs text-muted">Дата подачи</dt><dd className="mt-1 text-sm text-white">{formatDate(application.createdAt)}</dd></div><div className="londo-ui-section p-4"><dt className="text-xs text-muted">Начало обзвона</dt><dd className="mt-1 text-sm text-white">{formatDate(application.callStartedAt)}</dd></div><div className="londo-ui-section p-4"><dt className="text-xs text-muted">Завершение</dt><dd className="mt-1 text-sm text-white">{formatDate(application.completedAt)}</dd></div><div className="londo-ui-section p-4"><dt className="text-xs text-muted">Рассмотрел</dt><dd className="mt-1 text-sm text-white">{application.reviewedBy ? application.reviewedBy.displayName : "—"}</dd></div></dl>

          {application.rejectionReason ? <section className="mt-5 rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-4"><h2 className="text-sm font-medium text-rose-100">Причина отклонения</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-rose-100/80">{application.rejectionReason}</p></section> : null}
          {canManageApplications(user, family) ? <ApplicationActions applicationId={application.id} family={slug} status={application.status} claimedByUserId={application.claimedByUserId} currentUserId={user.id} claimedByName={application.claimedBy?.displayName} /> : null}
          <CheckDialog applicationId={application.id} finalized={!isEditableApplicationStatus(application.status)} />
          {isEditableApplicationStatus(application.status) && answers ? <ApplicationEditor applicationId={application.id} family={slug} answers={answers} /> : null}
        </section>

        <section className="londo-ui-surface mt-5 p-5 sm:p-7"><h2 className="text-xl font-semibold text-white">Ответы анкеты</h2>{answers ? <dl className="mt-5 divide-y divide-white/10 rounded-2xl border border-white/10"><div className="px-4 py-4"><dt className="text-sm text-muted">Игровой никнейм | Статик</dt><dd className="mt-1 text-sm text-white">{answers.gameNicknameStatic}</dd></div><div className="px-4 py-4"><dt className="text-sm text-muted">Возраст OOC</dt><dd className="mt-1 text-sm text-white">{answers.oocAge}</dd></div><div className="px-4 py-4"><dt className="text-sm text-muted">Цель вступления</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white">{answers.joinReason}</dd></div><div className="px-4 py-4"><dt className="text-sm text-muted">Как узнали о семье</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white">{answers.discoverySource}</dd></div><div className="px-4 py-4"><dt className="text-sm text-muted">Скрин персонажей</dt><dd className="mt-1 text-sm"><a href={answers.charactersScreenshotUrl} target="_blank" rel="noopener noreferrer" className="break-all text-accent-soft hover:text-white">Открыть скрин персонажей</a></dd></div></dl> : <p className="londo-ui-section mt-4 p-4 text-sm text-muted">Заявка содержит устаревший формат ответов.</p>}</section>
        <ApplicationEditHistory entries={auditTrail.filter(entry => entry.action === "APPLICATION_EDITED")} />
        <ApplicantHistory entries={applicantHistory} />
        <section className="londo-ui-surface mt-5 p-5 sm:p-7"><h2 className="text-xl font-semibold text-white">История действий</h2><ol className="mt-5 space-y-4">{auditTrail.length ? auditTrail.map((entry) => <li key={entry.id} className="border-l border-accent/40 pl-4"><p className="text-sm text-white">{auditLabel(entry.action)}</p><p className="mt-1 text-xs text-muted">{formatDate(entry.createdAt)}{entry.actor ? ` · ${entry.actor.displayName}` : ""}</p></li>) : <li className="text-sm text-muted">Действий пока нет.</li>}</ol></section>
      </main>
    </div>
  );
}
