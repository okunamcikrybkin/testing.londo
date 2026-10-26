import type { Prisma } from "@prisma/client";
import { familyLabel } from "@/lib/applications/families";
import { StatusBadge } from "@/components/applications/status-badge";
import { FamilyServerIcon } from "@/components/family-server-icon";

type HistoryEntry = Prisma.FamilyApplicationGetPayload<{
  include: { reviewedBy: { select: { displayName: true; username: true } } };
}>;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function ApplicantHistory({ entries }: { entries: HistoryEntry[] }) {
  return (
    <section className="londo-ui-surface mt-5 p-5 sm:p-7" aria-labelledby="applicant-history-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="londo-ui-eyebrow">ПРЕДЫДУЩИЕ ОБРАЩЕНИЯ</p>
          <h2 className="mt-2 text-xl font-semibold text-white" id="applicant-history-title">История заявок пользователя</h2>
          <p className="londo-ui-description mt-2">Прошлые решения помогают учитывать контекст при рассмотрении новой заявки.</p>
        </div>
        {entries.length ? <span className="londo-ui-badge">{entries.length} из последних</span> : null}
      </div>

      {entries.length ? (
        <div className="mt-5 grid gap-3">
          {entries.map((entry) => {
            const decisionReason = entry.rejectionReason?.trim();
            return (
              <article key={entry.id} className="londo-ui-section p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">Заявка на вступление</h3>
                      <span className="londo-ui-badge">
                        <FamilyServerIcon family={entry.family} size="inline" />
                        {familyLabel(entry.family)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">Подана {formatDate(entry.createdAt)}</p>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">Рассмотрел</dt>
                    <dd className="mt-1 text-white">{entry.reviewedBy?.displayName ?? entry.reviewedBy?.username ?? "Рекрут не указан"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Дата решения</dt>
                    <dd className="mt-1 text-white">{formatDate(entry.completedAt ?? entry.updatedAt)}</dd>
                  </div>
                </dl>

                <div className={`mt-4 rounded-xl border p-3 ${entry.status === "REJECTED" ? "border-rose-300/15 bg-rose-300/[0.05]" : "border-emerald-300/15 bg-emerald-300/[0.05]"}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Комментарий к решению</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/85">
                    {decisionReason ?? (entry.status === "ACCEPTED" ? "Одобрено без дополнительного комментария." : "Причина отклонения не указана.")}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="londo-ui-empty mt-5">
          <strong>Предыдущих заявок нет</strong>
          <span>Это первая заявка пользователя в системе.</span>
        </div>
      )}
    </section>
  );
}
