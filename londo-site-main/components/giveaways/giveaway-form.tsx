"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { mentionRoleFormValue } from "@/lib/giveaways/validation";
import { FamilyServerIcon } from "@/components/family-server-icon";

type Initial = { description: string; discordChannelId: string; endsAt: string; family: string; imageUrl: string | null; mentionRoleId: string | null; prize: string; requiredRoleId: string | null; winnerCount: number };

function localDate(value?: string): string {
  if (value) return new Date(value).toISOString().slice(0, 16);
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
}

export function GiveawayForm({ initial }: { initial?: Initial }) {
  const router = useRouter(); const formRef = useRef<HTMLFormElement>(null); const [step, setStep] = useState(0); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false); const [mentionMode, setMentionMode] = useState(initial?.mentionRoleId === "FAM" ? "FAM" : initial?.mentionRoleId ? "CUSTOM_ROLE" : "NONE"); const [options, setOptions] = useState<{ channels: Array<{ id: string; name: string }>; roles: Array<{ id: string; name: string }> } | null>(null); const [optionsError, setOptionsError] = useState<string | null>(null);
  async function fetchOptions(): Promise<{ channels: Array<{ id: string; name: string }>; roles: Array<{ id: string; name: string }> }> { const response = await fetch("/api/giveaways/discord-options", { cache: "no-store" }); const body = await response.json().catch(() => ({})); if (!response.ok || !Array.isArray(body.channels) || !Array.isArray(body.roles)) throw new Error(); return { channels: body.channels, roles: body.roles }; }
  async function loadOptions() { setOptionsError(null); try { setOptions(await fetchOptions()); } catch { setOptionsError("Не удалось получить каналы и роли Discord. Проверьте, что LONDO Bot запущен."); } }
  useEffect(() => { let active = true; void fetchOptions().then((result) => { if (active) setOptions(result); }).catch(() => { if (active) setOptionsError("Не удалось получить каналы и роли Discord. Проверьте, что LONDO Bot запущен."); }); return () => { active = false; }; }, []);
  function validateStep(stepIndex: number): boolean {
    const panel = formRef.current?.querySelector<HTMLElement>(`[data-giveaway-step="${stepIndex}"]`);
    if (!panel) return false;
    const invalid = Array.from(panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select"))
      .find((field) => !field.disabled && !field.checkValidity());
    if (!invalid) return true;
    invalid.reportValidity();
    invalid.focus();
    return false;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep(step)) return;
    if (step < 2) {
      setError(null);
      setStep((current) => current + 1);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[data-giveaway-heading="${step + 1}"]`)?.focus());
      return;
    }
    if (!options) {
      setError(optionsError ?? "Подожди, пока загрузятся каналы и роли Discord.");
      return;
    }
    setPending(true); setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries()) as Record<string, FormDataEntryValue>;
      const requestPayload: Record<string, string | number | FormDataEntryValue> = { ...payload, winnerCount: Number(payload.winnerCount) };
      requestPayload.mentionMode = mentionMode;
      requestPayload.mentionRoleId = mentionRoleFormValue(mentionMode as "NONE" | "FAM" | "CUSTOM_ROLE", typeof requestPayload.mentionRoleId === "string" || requestPayload.mentionRoleId instanceof File ? requestPayload.mentionRoleId : undefined);
      const response = await fetch(initial ? `/api/giveaways/${location.pathname.split("/").at(-1)}` : "/api/giveaways", { method: initial ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(requestPayload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error ?? "Не удалось сохранить розыгрыш."); return; }
      router.push(`/giveaways/${body.giveaway.id}`); router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Все введённые данные сохранены — попробуй ещё раз.");
    } finally {
      setPending(false);
    }
  }
  const steps = ["О розыгрыше", "Сроки и площадка", "Кому и где показать"];
  return <form ref={formRef} noValidate onSubmit={submit} className="londo-card rounded-[2rem] p-5 sm:p-8" aria-label={initial ? "Редактирование розыгрыша" : "Создание розыгрыша"}>
    <div className="londo-form-progress" aria-label={`Шаг ${step + 1} из ${steps.length}`}>
      <div className="londo-form-progress-copy"><span>Шаг {step + 1} из {steps.length}</span><strong>{steps[step]}</strong></div>
      <div className="londo-form-progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}><span style={{ transform: `scaleX(${(step + 1) / steps.length})` }} /></div>
      <ol>{steps.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-complete" : ""}><span>{index < step ? "✓" : index + 1}</span>{label}</li>)}</ol>
    </div>
    <section data-giveaway-step="0" hidden={step !== 0} aria-labelledby="giveaway-step-heading-0">
      <h2 id="giveaway-step-heading-0" data-giveaway-heading="0" tabIndex={-1} className="londo-form-step-title">Что разыгрываем?</h2>
      <p className="londo-form-step-hint">Опиши приз и условия так, чтобы участникам было понятно, что они получат.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-muted md:col-span-2">Название приза *<input name="prize" defaultValue={initial?.prize} maxLength={200} required className="logs-input" /></label>
        <label className="grid gap-2 text-sm text-muted md:col-span-2">Условия участия *<textarea name="description" defaultValue={initial?.description} maxLength={2000} required rows={5} className="logs-input h-auto py-3" /></label>
      </div>
    </section>
    <section data-giveaway-step="1" hidden={step !== 1} aria-labelledby="giveaway-step-heading-1">
      <h2 id="giveaway-step-heading-1" data-giveaway-heading="1" tabIndex={-1} className="londo-form-step-title">Когда и где пройдёт розыгрыш?</h2>
      <p className="londo-form-step-hint">Выбери время завершения, число победителей и канал публикации.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-muted">Число победителей *<input name="winnerCount" type="number" min={1} max={20} defaultValue={initial?.winnerCount ?? 1} required className="logs-input" /></label>
        <label className="grid gap-2 text-sm text-muted">Дата и время окончания *<input name="endsAt" type="datetime-local" defaultValue={localDate(initial?.endsAt)} required className="logs-input" /></label>
        <label className="grid gap-2 text-sm text-muted md:col-span-2">Канал Discord *<select name="discordChannelId" defaultValue={initial?.discordChannelId ?? ""} required disabled={!options} className="logs-input"><option value="" disabled>{options ? "Выберите канал" : "Загрузка каналов..."}</option>{options?.channels.map((channel) => <option key={channel.id} value={channel.id}># {channel.name}</option>)}</select></label>
      </div>
    </section>
    <section data-giveaway-step="2" hidden={step !== 2} aria-labelledby="giveaway-step-heading-2">
      <h2 id="giveaway-step-heading-2" data-giveaway-heading="2" tabIndex={-1} className="londo-form-step-title">Кто увидит публикацию?</h2>
      <p className="londo-form-step-hint">Настрой охват, изображение и уведомление участников.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <fieldset className="family-filter-options md:col-span-2"><legend>Для кого розыгрыш?</legend><label><input type="radio" name="family" value="ALL" defaultChecked={(initial?.family ?? "ALL") === "ALL"} /><span>Все семьи</span></label>{(["MEMPHIS"] as const).map(family=><label key={family} title={family}><input type="radio" name="family" value={family} defaultChecked={initial?.family===family} /><FamilyServerIcon family={family} size="inline" /> <span>{family}</span></label>)}</fieldset>
        <label className="grid gap-2 text-sm text-muted">Ссылка на изображение<input name="imageUrl" type="url" defaultValue={initial?.imageUrl ?? ""} className="logs-input" /></label>
        <label className="grid gap-2 text-sm text-muted">Требуемая роль<select name="requiredRoleId" defaultValue={initial?.requiredRoleId ?? ""} disabled={!options} className="logs-input"><option value="">Не ограничивать по роли</option>{options?.roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm text-muted">Уведомить участников<select value={mentionMode} onChange={(event) => setMentionMode(event.target.value)} className="logs-input"><option value="NONE">Без уведомления</option><option value="FAM">Упомянуть FAM</option><option value="CUSTOM_ROLE">Упомянуть роль</option></select></label>
        {mentionMode === "CUSTOM_ROLE" ? <label className="grid gap-2 text-sm text-muted">Роль для уведомления<select name="mentionRoleId" defaultValue={initial?.mentionRoleId ?? ""} required disabled={!options} className="logs-input"><option value="" disabled>Выберите роль</option>{options?.roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></label> : null}
      </div>
    </section>
    {optionsError ? <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"><span>{optionsError}</span><button type="button" onClick={() => void loadOptions()} className="londo-button-ghost h-8 px-3">Повторить</button></div> : null}
    {error ? <p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
    <div className="londo-form-actions">
      {step > 0 && <button type="button" disabled={pending} className="londo-button-ghost px-5" onClick={() => { setError(null); setStep((current) => current - 1); }}>Назад</button>}
      <button type="submit" disabled={pending} className="londo-button px-5 disabled:opacity-60">{pending ? "Сохраняем…" : step < 2 ? "Продолжить" : initial ? "Сохранить изменения" : "Создать розыгрыш"}</button>
    </div>
  </form>;
}
