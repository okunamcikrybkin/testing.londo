"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function StaffAccessAction({ action, label, requestId, userId }: { action: string; label: string; requestId?: string; userId?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const [open, setOpen] = useState(false), [reason, setReason] = useState("");
  const needsConfirm = ["REJECT", "REVOKE", "RESET_PIN"].includes(action);
  async function submit() {
    setPending(true); setMessage("");
    try {
      const res = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...(requestId ? { requestId } : {}), ...(userId ? { userId } : {}), ...(action === "REJECT" ? { reason } : {}) }) });
      const result = await res.json(); setMessage(result.error || result.message);
      if (res.ok) { setOpen(false); router.refresh(); }
    } catch { setMessage("Не удалось связаться с сервером."); } finally { setPending(false); }
  }
  return <div className="inline-flex max-w-full flex-col items-start gap-2">
    <button className="londo-button-ghost min-h-10 px-4" disabled={pending} onClick={() => needsConfirm ? setOpen(!open) : void submit()}>{pending ? "Обработка…" : label}</button>
    {open && <div className="w-full max-w-md rounded-xl border border-white/15 p-4">
      <p className="mb-3 text-sm">{action === "RESET_PIN" ? "Старый код перестанет работать. Пользователь настроит новый самостоятельно." : action === "REVOKE" ? "Дополнительные права пользователя будут сняты во всех сессиях." : "Укажите причину отклонения."}</p>
      {action === "REJECT" && <label className="block text-sm">Причина<textarea value={reason} onChange={e => setReason(e.target.value)} minLength={3} maxLength={1000} className="mt-2 block w-full rounded-lg border border-white/20 bg-black/30 p-3" /></label>}
      <div className="mt-3 flex gap-3"><button className="londo-button px-4 py-2" disabled={pending || (action === "REJECT" && reason.trim().length < 3)} onClick={() => void submit()}>Подтвердить</button><button onClick={() => setOpen(false)}>Отмена</button></div>
    </div>}
    {message && <p role="status" className="max-w-md text-sm text-muted">{message}</p>}
  </div>;
}
export function StaffPinForm({ setup, next }: { setup: boolean; next: string }) {
  const router = useRouter();
  const [pin, setPin] = useState(""), [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  return <form className="mt-6 space-y-5" onSubmit={async event => {
    event.preventDefault(); setPending(true); setError("");
    try {
      const result = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: setup ? "PIN_SETUP" : "PIN_VERIFY", pin, ...(setup ? { confirmation } : {}), next }) });
      const data = await result.json();
      setPin(""); setConfirmation("");
      if (!result.ok) { setError(data.error || "Не удалось подтвердить код."); return; }
      router.replace(data.next); router.refresh();
    } catch { setError("Не удалось связаться с сервером."); } finally { setPending(false); }
  }}>
    <label className="block text-sm">{setup ? "Новый защитный код" : "Введите защитный код"}<input autoFocus type="password" inputMode="numeric" autoComplete={setup ? "new-password" : "current-password"} pattern="[0-9]{4}" minLength={4} maxLength={4} required value={pin} onChange={e => setPin(e.target.value)} className="mt-2 block w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-center text-3xl tracking-[.5em]" /></label>
    {setup && <label className="block text-sm">Повторите код<input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" minLength={4} maxLength={4} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-2 block w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-center text-3xl tracking-[.5em]" /></label>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <button className="londo-button min-h-11 w-full px-6" disabled={pending}>{pending ? "Проверка…" : setup ? "Сохранить" : "Продолжить"}</button>
    <p className="text-xs text-muted">{setup ? "Ровно 4 цифры. Сохраните код: администрация не сможет его посмотреть." : "Забыли код? Обратитесь к владельцу сообщества для сброса."}</p>
  </form>;
}
