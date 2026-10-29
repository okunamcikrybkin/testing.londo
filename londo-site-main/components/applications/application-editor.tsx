"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationAnswers } from "@/lib/applications/answers";
import { editApplicationAction } from "@/lib/applications/edit-action";
import { applicationAnswerLabels } from "@/lib/applications/edit-policy";

const limits = { gameNickname: 32, staticId: 30, oocAge: 20, joinReason: 2000, discoverySource: 1000, charactersScreenshotUrl: 500 };
export function ApplicationEditor({ applicationId, family, answers }: { applicationId: string; family: string; answers: ApplicationAnswers }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const result = await editApplicationAction(applicationId, family, Object.fromEntries(new FormData(event.currentTarget)));
      setMessage(result.message);
      if (result.ok) { dialog.current?.close(); router.refresh(); }
    } catch { setMessage("Не удалось сохранить изменения. Проверьте соединение и повторите попытку."); }
    finally { setPending(false); }
  }
  return <div className="mt-4">
    <button type="button" className="londo-button-ghost px-4 py-2.5" onClick={() => { form.current?.reset(); setMessage(""); dialog.current?.showModal(); }}>Редактировать заявку</button>
    <p role="status" className="mt-2 text-sm text-muted">{message}</p>
    <dialog ref={dialog} aria-labelledby="edit-application-title" onCancel={event => { if (pending) event.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#12121b] p-6 text-white shadow-2xl backdrop:bg-black/70">
      <form ref={form} onSubmit={save}>
        <h2 id="edit-application-title" className="text-xl font-semibold">Редактировать заявку</h2>
        <fieldset disabled={pending} className="mt-5 space-y-4">
          {Object.entries(applicationAnswerLabels).map(([field, label]) => { const key = field as keyof ApplicationAnswers; return <label key={key} className="block text-sm">{label}
            <textarea name={key} defaultValue={answers[key]} required maxLength={limits[key]} rows={key === "joinReason" || key === "discoverySource" ? 3 : 1} className="mt-2 block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white focus:outline-2 focus:outline-accent" />
          </label>; })}
          <p className="text-xs text-muted">Возраст: 16–99. Ссылка на скриншот должна начинаться с http:// или https://.</p>
          <p role="alert" className="text-sm text-rose-200">{message}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="londo-button-ghost px-4 py-2" onClick={() => dialog.current?.close()}>Отмена</button>
            <button type="submit" className="londo-button-primary px-4 py-2 disabled:opacity-50">{pending ? "Сохранение…" : "Сохранить изменения"}</button>
          </div>
        </fieldset>
      </form>
    </dialog>
  </div>;
}
