"use client";

import { type FormEvent, useActionState, useEffect, useState } from "react";
import type { ApplicationStatus } from "@prisma/client";
import { mutateApplicationAction } from "@/lib/applications/actions";
import { initialApplicationActionState } from "@/lib/applications/action-state";
import { normalizeRejectionReason } from "@/lib/applications/rejection-reason";

type ApplicationActionsProps = {
  applicationId: string;
  family: "memphis" | "phoenix";
  status: ApplicationStatus;
  claimedByUserId: string | null;
  currentUserId: string;
  claimedByName?: string | null;
};

export function ApplicationActions({
  applicationId,
  family,
  status,
  claimedByUserId,
  currentUserId,
  claimedByName,
}: ApplicationActionsProps) {
  const [state, formAction, isPending] = useActionState(
    mutateApplicationAction,
    initialApplicationActionState,
  );
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionClientError, setRejectionClientError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  useEffect(() => {
    const message = rejectionClientError ?? state.message;
    if (!message) return;
    const showTimeout = window.setTimeout(() => setToast({ message, ok: rejectionClientError ? false : state.ok }), 0);
    const hideTimeout = window.setTimeout(() => setToast(null), 5500);
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [rejectionClientError, state.message, state.ok]);

  function validateRejectionReason(event: FormEvent<HTMLFormElement>) {
    const reason = new FormData(event.currentTarget).get("rejectionReason");

    if (typeof reason !== "string" || !normalizeRejectionReason(reason)) {
      event.preventDefault();
      setRejectionClientError("Укажите причину отклонения.");
      return;
    }

    setRejectionClientError(null);
  }

  if (status === "ACCEPTED" || status === "REJECTED") {
    return null;
  }

  if (claimedByUserId && claimedByUserId !== currentUserId) {
    return <section className="londo-ui-alert mt-6" data-tone="warning">Эта заявка уже закреплена за {claimedByName ?? "другим рекрутом"}.</section>;
  }

  if (!claimedByUserId) {
    return <section className="londo-ui-alert mt-6" data-tone="warning">Сначала возьмите заявку в работу из списка заявок.</section>;
  }

  if (claimedByUserId === currentUserId) {
    // The action controls below are rendered together with this status in the same card.
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="londo-ui-alert mb-4" data-tone="info">Заявка закреплена за вами и находится на рассмотрении.</p>
      <h2 className="text-lg font-semibold text-white">Действия рекрутера</h2>
      <p className="mt-1 text-sm text-muted">Статус меняется только после серверной проверки и подтверждения Discord.</p>

      <form action={formAction} className="mt-4 flex flex-wrap gap-3">
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="family" value={family} />
        {status === "NEW" ? (
          <button
            type="submit"
            name="intent"
            value="start-call"
            disabled={isPending}
            className="londo-button px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Обработка..." : "Вызвать на обзвон"}
          </button>
        ) : null}
        {status === "CALL" ? (
          <button
            type="submit"
            name="intent"
            value="accept"
            disabled={isPending}
            onClick={(event) => {
              if (!window.confirm("Выдать роли семьи и принять заявку?")) {
                event.preventDefault();
              }
            }}
            className="londo-button-success px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Обработка..." : "Принять"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={isPending}
          onClick={() => setRejectOpen(true)}
          className="londo-button-danger px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          Отклонить
        </button>
      </form>

      {toast ? (
        <div className={`fixed bottom-5 right-5 z-[100] w-[min(92vw,32rem)] rounded-2xl border px-5 py-4 text-sm shadow-2xl backdrop-blur-xl sm:bottom-6 sm:right-6 ${toast.ok ? "border-emerald-300/25 bg-[#102019]/95 text-emerald-100" : "border-rose-300/25 bg-[#241316]/95 text-rose-100"}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}

      {rejectOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reject-dialog-title">
          <form action={formAction} onSubmit={validateRejectionReason} className="londo-ui-surface londo-ui-surface-raised w-full max-w-lg p-6 sm:p-7">
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="family" value={family} />
            <input type="hidden" name="intent" value="reject" />
            <p className="londo-ui-eyebrow">РЕШЕНИЕ ПО ЗАЯВКЕ</p>
            <h3 id="reject-dialog-title" className="londo-ui-title mt-2 text-2xl">Отклонить заявку</h3>
            <label className="londo-ui-label mt-5 block" htmlFor="rejectionReason">Причина отклонения</label>
            <textarea id="rejectionReason" name="rejectionReason" required minLength={1} maxLength={1000} rows={5} className="londo-ui-control mt-2" placeholder="Укажите причину отклонения." />
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setRejectOpen(false)} className="londo-ui-button">Отмена</button>
              <button type="submit" disabled={isPending} className="londo-ui-button londo-ui-button-danger disabled:opacity-60">{isPending ? "Обработка..." : "Подтвердить отклонение"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
