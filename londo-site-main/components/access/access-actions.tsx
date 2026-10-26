"use client";

import { useActionState, useState } from "react";
import { approveAccessRequest, createAccessRequest, rejectAccessRequest } from "@/lib/access/actions";
import { initialAccessActionState } from "@/lib/access/action-state";

export function RequestAccessButton() {
  const [state, action, pending] = useActionState(createAccessRequest, initialAccessActionState);
  return <form action={action} className="mt-6"><button disabled={pending} className="londo-button px-5 py-2.5 text-sm disabled:opacity-60">{pending ? "Проверяем..." : "Запросить доступ"}</button>{state.message ? <p className={`mt-3 text-sm ${state.ok ? "text-emerald-200" : "text-rose-200"}`} role="status">{state.message}</p> : null}</form>;
}

export function AccessRequestActions({ requestId }: { requestId: string }) {
  const [approveState, approveAction, approving] = useActionState(approveAccessRequest, initialAccessActionState);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectAccessRequest, initialAccessActionState);
  const [rejectOpen, setRejectOpen] = useState(false);
  const state = approveState.message ? approveState : rejectState;
  return <div className="mt-4"><div className="flex gap-2"><form action={approveAction}><input type="hidden" name="requestId" value={requestId} /><button disabled={approving || rejecting} className="londo-button-success px-4 py-2 text-sm disabled:opacity-60">Одобрить</button></form><button type="button" disabled={approving || rejecting} onClick={() => setRejectOpen(true)} className="londo-button-danger px-4 py-2 text-sm disabled:opacity-60">Отклонить</button></div>{state.message ? <p className={`mt-3 text-sm ${state.ok ? "text-emerald-200" : "text-rose-200"}`} role="status">{state.message}</p> : null}{rejectOpen ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"><form action={rejectAction} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#12121b] p-6"><input type="hidden" name="requestId" value={requestId} /><h3 className="text-xl font-semibold text-white">Отклонить запрос</h3><label className="mt-4 block text-sm text-muted" htmlFor={`reason-${requestId}`}>Причина отклонения</label><textarea id={`reason-${requestId}`} name="reason" required minLength={3} maxLength={1000} rows={4} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white" /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRejectOpen(false)} className="londo-button-ghost px-4 py-2 text-sm">Отмена</button><button disabled={rejecting} className="londo-button-danger px-4 py-2 text-sm disabled:opacity-60">Подтвердить</button></div></form></div> : null}</div>;
}
