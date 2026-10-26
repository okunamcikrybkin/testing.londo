"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge, Field, Section, type Family, type Rank } from "./ui";
import { LondoSelect, type LondoOption } from "@/components/profile/londo-select";
import styles from "./promotions.module.css";

type MemberFamily = { family: Family; currentRank: string | null; enabled: boolean; settings: { title: string; description: string } | null };
type UserApplication = { id: string; family: Family; rankName: string; currentRank: string | null; status: string; createdAt: string; reviewedAt: string | null; reviewedByDiscordId: string | null; rejectionReason: string | null; lastError: string | null; answers: { label: string; value: string }[] };
type ApplicantRank = Omit<Rank, "id" | "questions"> & { id: string; version: number; questions: (Rank["questions"][number] & { id: string })[] };
type Catalog = { families: MemberFamily[]; ranks: ApplicantRank[]; applications: UserApplication[] };

export function PromotionApplyClient() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [family, setFamily] = useState<Family | "">("");
  const [rankId, setRankId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/promotions/apply", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Не удалось загрузить данные.");
    setCatalog(body as Catalog);
    setFamily(current => current && body.families.some((item: MemberFamily) => item.family === current && item.enabled) ? current : body.families.find((item: MemberFamily) => item.enabled)?.family ?? "");
  }
  useEffect(() => { load().catch(error => setMessage({ text: error instanceof Error ? error.message : "Ошибка загрузки.", error: true })).finally(() => setLoading(false)); }, []);

  const selectedFamily = catalog?.families.find(item => item.family === family);
  const ranks = useMemo(() => catalog?.ranks.filter(item => item.family === family) ?? [], [catalog, family]);
  const rank = ranks.find(item => item.id === rankId);
  const familyOptions = useMemo<LondoOption<Family | "">[]>(() => [
    { value: "", label: "Выберите семью", disabled: true },
    ...(catalog?.families.map(item => ({ value: item.family, label: `${item.family}${item.currentRank ? ` · ${item.currentRank}` : ""}${!item.enabled ? " · приём закрыт" : ""}`, disabled: !item.enabled })) ?? []),
  ], [catalog]);
  const rankOptions = useMemo<LondoOption<string>[]>(() => [
    { value: "", label: "Выберите ранг", disabled: true },
    ...ranks.map(item => ({ value: item.id, label: item.name })),
  ], [ranks]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!family || !rank) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/promotions/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ family, rankId, version: rank.version, answers }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Не удалось отправить заявку.");
      setMessage({ text: "Заявка отправлена на рассмотрение. Результат придёт в личные сообщения Discord.", error: false });
      setRankId(""); setAnswers({}); await load();
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "Не удалось отправить заявку.", error: true }); }
    finally { setBusy(false); }
  }

  return <div className={styles.root} aria-busy={busy || loading}>
    <a className={styles.back} href="/profile">← Профиль</a>
    <header className={styles.hero}><div className={styles.heroCopy}><p className={styles.eyebrow}>LONDO · РАЗВИТИЕ</p><h1>Заявка на повышение</h1><p>Выберите семью и ранг, ознакомьтесь с требованиями и заполните форму. Заявка попадёт рекрутерам на сайте.</p></div></header>
    {message && <p className={styles.notice} data-tone={message.error ? "error" : "info"} role={message.error ? "alert" : "status"}>{message.text}</p>}
    {loading ? <p className={styles.loading} role="status">Загружаем доступные ранги…</p> : !catalog?.families.length ? <div className={styles.empty}><h2>Нет активного членства в семье</h2><p>Форма повышения доступна участникам MEMPHIS с активным членством.</p></div> : <>
      <Section title="Новая заявка" description={selectedFamily?.settings?.description || "Требования и вопросы настраиваются отдельно для каждого ранга."}>
        {!catalog.families.some(item => item.enabled) ? <p className={styles.smallText}>Приём заявок на повышение сейчас отключён.</p> : <form className={styles.formStack} onSubmit={submit}>
          <LondoSelect value={family} options={familyOptions} onValueChange={value => { setFamily(value); setRankId(""); setAnswers({}); }} ariaLabel="Семья" placeholder="Выберите семью" accent="#E6B77A" disabled={!catalog.families.some(item => item.enabled)} />
          <LondoSelect value={rankId} options={rankOptions} onValueChange={value => { setRankId(value); setAnswers({}); }} ariaLabel="Ранг или должность" placeholder="Выберите ранг" accent="#E6B77A" disabled={!family || !ranks.length} />
          {rank && <>
            <div className={styles.panelPreview}><h3>{rank.name}</h3>{rank.description && <p>{rank.description}</p>}{rank.criteria.length > 0 && <><strong>Критерии</strong><ul>{rank.criteria.map((item, index) => <li key={`${item.text}-${index}`}>{item.text}{item.isRequired ? " · обязательно" : ""}</li>)}</ul></>}</div>
            {rank.questions.map(question => <Field key={question.id} title={question.label} hint={question.placeholder || undefined}>{question.type === "SHORT" ? <input required={question.required} minLength={question.minLength || undefined} maxLength={question.maxLength || undefined} value={answers[question.id] ?? ""} onChange={event => setAnswers({ ...answers, [question.id]: event.target.value })} /> : <textarea required={question.required} minLength={question.minLength || undefined} maxLength={question.maxLength || undefined} rows={4} value={answers[question.id] ?? ""} onChange={event => setAnswers({ ...answers, [question.id]: event.target.value })} />}</Field>)}
            <div className={styles.formFooter}><button className={styles.primary} disabled={busy}>{busy ? "Отправка…" : "Отправить заявку"}</button></div>
          </>}
        </form>}
      </Section>
      <Section title="Мои заявки" description="Здесь отображается история отправленных заявок.">
        {!catalog.applications.length ? <p className={styles.smallText}>Вы ещё не подавали заявки на повышение.</p> : <div className={styles.cards}>{catalog.applications.map(application => <article className={styles.card} key={application.id}><div className={styles.cardTop}><div><p className={styles.eyebrow}>{application.family}</p><h2>{application.rankName}</h2><p>{new Date(application.createdAt).toLocaleString("ru-RU")}</p></div><Badge status={application.status} /></div>{application.status === "REJECTED" && application.rejectionReason && <span className={styles.notice} data-tone="error">Причина отказа: {application.rejectionReason}</span>}{application.status === "APPROVING" && <p className={styles.smallText}>Решение принято, бот завершает выдачу роли.</p>}</article>)}</div>}
      </Section>
    </>}
  </div>;
}
