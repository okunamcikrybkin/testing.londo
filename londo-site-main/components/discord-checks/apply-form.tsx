"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { parseApplicationAnswers } from "@/lib/applications/answers";
import { FamilyServerIcon } from "@/components/family-server-icon";
import { Icon } from "@/components/promotions/ui";
import { applyRequest } from "./client";
import s from "./ui.module.css";

type Family = "MEMPHIS";
type Own = { id: string; family: Family; createdAt: string; status: string; answers: unknown };
type Consent = "NOT_GRANTED" | "GRANTED" | "REVOKED";

const steps = ["Discord", "Семья", "О себе", "Интерес", "Проверка"];
const fields = [
  { key: "gameNicknameStatic", label: "Игровой никнейм или статик", hint: "Напиши игровой ник. После одобрения заявки бот установит его как твой ник в Discord.", max: 32, rows: 1 },
  { key: "oocAge", label: "Возраст вне игры", hint: "Укажи возраст цифрами. Подать заявку можно с 14 лет.", max: 2, rows: 1 },
  { key: "joinReason", label: "Почему хочешь вступить?", hint: "Пары предложений достаточно. Нам важно понять, что ты ищешь в LONDO.", max: 2000, rows: 4 },
  { key: "discoverySource", label: "Как ты узнал о нас?", hint: "Например: друзья, игровой сервер или знакомство в Discord.", max: 1000, rows: 2 },
  { key: "charactersScreenshotUrl", label: "Ссылка на скриншот персонажей", hint: "Подойдёт любая ссылка, начинающаяся с https:// или http://.", max: 500, rows: 1 },
] as const;
const profileFields = fields.slice(0, 2);
const motivationFields = fields.slice(2);
type AnswerKey = (typeof fields)[number]["key"];
type Answers = Record<AnswerKey, string>;

const emptyAnswers: Answers = {
  gameNicknameStatic: "",
  oocAge: "",
  joinReason: "",
  discoverySource: "",
  charactersScreenshotUrl: "",
};
const familyLabel: Record<Family, string> = { MEMPHIS: "Memphis" };
const applicationStatus: Record<string, string> = {
  NEW: "Получена",
  CALL: "Приглашаем на собеседование",
  ACCEPTED: "Одобрена",
  REJECTED: "Не одобрена",
};
const pendingStatuses = new Set(["NEW", "CALL"]);

function getCallbackError(result: string) {
  if (!result || ["granted", "declined"].includes(result)) return "";
  if (result === "account_changed") return "Открыт другой Discord-аккаунт. Вернись и повтори попытку с аккаунтом, под которым вошёл на сайт.";
  if (result === "missing_scopes") return "Discord не предоставил нужные разрешения. Можно повторить проверку позже.";
  if (result === "invalid") return "Ссылка на проверку устарела. Запусти её ещё раз.";
  return "Не получилось получить согласие Discord. Попробуй ещё раз.";
}

export function ApplyForm({ consentResult, initialFamily = "" }: { consentResult: string; initialFamily?: Family | "" }) {
  const [applications, setApplications] = useState<Own[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState("");
  const [consent, setConsent] = useState<Consent>("NOT_GRANTED");
  const [needsRoleConsent, setNeedsRoleConsent] = useState(false);
  const [member, setMember] = useState(false);
  const [family, setFamily] = useState<Family | "">(initialFamily);
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [checking, setChecking] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const declined = consentResult === "declined";
  const consentInFlight = useRef(false);
  const callbackError = getCallbackError(consentResult);
  const progress = (step / steps.length) * 100;

  const loadApplications = useCallback(async (signal?: AbortSignal) => {
    setApplicationsLoading(true);
    setApplicationsError("");
    try {
      const response = await fetch("/api/apply", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Не удалось загрузить список заявок.");
      const data = await response.json();
      setApplications(data.applications);
      setConsent(data.consent);
      setNeedsRoleConsent(Boolean(data.needsRoleConsent));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setApplicationsError(cause instanceof Error ? cause.message : "Не удалось загрузить список заявок.");
    } finally {
      if (!signal?.aborted) setApplicationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/apply", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить список заявок.");
        return response.json();
      })
      .then((data) => {
        setApplications(data.applications);
        setConsent(data.consent);
        setNeedsRoleConsent(Boolean(data.needsRoleConsent));
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setApplicationsError(cause instanceof Error ? cause.message : "Не удалось загрузить список заявок.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setApplicationsLoading(false);
      });
    return () => controller.abort();
  }, []);

  function goTo(nextStep: number) {
    setError("");
    setNotice("");
    setStep(nextStep);
    requestAnimationFrame(() => document.getElementById("application-step")?.focus({ preventScroll: true }));
    document.getElementById("application-step")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function checkMembership() {
    if (checking) return;
    setChecking(true);
    setError("");
    setNotice("");
    try {
      const result = await applyRequest<{ status: string }>({ operation: "MEMBERSHIP" });
      if (result.status !== "MEMBER") {
        throw new Error(result.status === "NOT_MEMBER"
          ? "Не нашли твой аккаунт на сервере LONDO. Проверь, что вошёл в Discord с нужного аккаунта и уже присоединился к серверу."
          : "Проверка Discord сейчас недоступна. Это не означает, что тебя нет на сервере. Попробуй немного позже.");
      }
      setMember(true);
      goTo(2);
      setNotice("Участие подтверждено. Теперь выбери семью.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось проверить Discord. Попробуй ещё раз.");
    } finally {
      setChecking(false);
    }
  }

  async function beginConsent() {
    if (consentInFlight.current || consentBusy) return;
    consentInFlight.current = true;
    setConsentBusy(true);
    setError("");
    try {
      const result = await applyRequest<{ url: string }>({ operation: "CONSENT" });
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось открыть Discord. Попробуй ещё раз.");
    } finally {
      consentInFlight.current = false;
      setConsentBusy(false);
    }
  }

  async function revokeConsent() {
    setSubmitting(true);
    setError("");
    try {
      await applyRequest({ operation: "REVOKE" });
      await loadApplications();
      setNotice("Согласие отозвано, сохранённые результаты проверки удалены.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отозвать согласие.");
    } finally {
      setSubmitting(false);
    }
  }

  function collectAnswers(event: FormEvent<HTMLFormElement>, nextStep: number) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form)) as Partial<Answers>;
    const updatedAnswers = { ...answers, ...values };
    if (nextStep === 4) {
      const age = Number(updatedAnswers.oocAge);
      if (!/^\d{1,2}$/.test(updatedAnswers.oocAge) || age < 14 || age > 99) {
        setError("Укажи возраст от 14 до 99 лет.");
        form.querySelector<HTMLInputElement>("#application-oocAge")?.focus();
        return;
      }
    }
    if (nextStep === 5 && !parseApplicationAnswers(updatedAnswers)) {
      setError("Проверь ответы и ссылку на скриншот — она должна начинаться с http:// или https://.");
      return;
    }
    setAnswers(updatedAnswers);
    setError("");
    goTo(nextStep);
  }

  async function submitApplication() {
    if (!family || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await applyRequest({ operation: "SUBMIT", family, answers });
      setNotice("Заявка отправлена. Статус можно посмотреть ниже.");
      setStep(1);
      setFamily("");
      setAnswers(emptyAnswers);
      await loadApplications();
      document.getElementById("my-applications")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не получилось отправить заявку. Ответы сохранены — можно повторить.");
    } finally {
      setSubmitting(false);
    }
  }

  const currentFamilyApplication = applications.find((application) => application.family === family && pendingStatuses.has(application.status));
  const visibleErrors = error;

  return (
    <div className={s.flow}>
      <div className={s.flowLayout}>
        <section className={s.flowMain} aria-label="Заявка в LONDO">
          <div className={s.progressHead}>
            <div>
              <p className={s.kicker}>Заявка · шаг {step} из {steps.length}</p>
              <p className={s.progressCaption}>{steps[step - 1]}</p>
            </div>
            <span className={s.estimatedTime}>Займёт около 3 минут</span>
          </div>
          <div className={s.progressTrack} role="progressbar" aria-label="Прогресс заявки" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step}>
            <span style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <ol className={s.stepList} aria-label="Этапы заявки">
            {steps.map((label, index) => {
              const number = index + 1;
              const complete = number < step;
              const current = number === step;
              return (
                <li className={`${s.stepItem} ${current ? s.stepCurrent : ""} ${complete ? s.stepComplete : ""}`} key={label} aria-current={current ? "step" : undefined}>
                  <span className={s.stepNumber}>{complete ? "✓" : number}</span>
                  <span className={s.stepLabel}>{label}</span>
                </li>
              );
            })}
          </ol>

          {visibleErrors && <div className={s.alertError} role="alert">{visibleErrors}</div>}
          {notice && <div className={s.alertSuccess} role="status">{notice}</div>}

          <div id="application-step" className={s.stepContent} tabIndex={-1} aria-live="polite">
            {step === 1 && (
              <section className={s.stepPanel}>
                <p className={s.stepEyebrow}>Начинаем с простого</p>
                <h2 className={s.stepTitle}>Уже в Discord LONDO?</h2>
                <p className={s.stepDescription}>Для заявки достаточно состоять на сервере. Роли, стаж и особые права не нужны — проверим только участие.</p>
                <div className={s.discordCheck}>
                  <span className={s.discordIcon} aria-hidden="true"><Icon name="discord" size={23} /></span>
                  <div className={s.discordCopy}>
                    <strong>Проверим твой аккаунт</strong>
                    <span>Это займёт несколько секунд. Пароль Discord нам недоступен.</span>
                  </div>
                  {member && <span className={s.checkBadge}>Участие подтверждено</span>}
                </div>
                <button type="button" className={s.primaryAction} onClick={() => void checkMembership()} disabled={checking} aria-busy={checking}>
                  {checking ? <><span className={s.spinner} aria-hidden="true" />Проверяем участие…</> : "Проверить и продолжить"}
                  {!checking && <span aria-hidden="true">→</span>}
                </button>
                <p className={s.privacyNote}>Если проверка временно недоступна, это не значит, что тебя нет на сервере. Попробуй ещё раз немного позже.</p>
              </section>
            )}

            {step === 2 && (
              <section className={s.stepPanel}>
                <p className={s.stepEyebrow}>Шаг 2 · выбери направление</p>
                <h2 className={s.stepTitle}>В какую семью подаёшь заявку?</h2>
                <p className={s.stepDescription}>Заявки принимаются в семью на сервере MEMPHIS. Подробности — <a href="/about" className={s.inlineLink}>на странице о LONDO</a>.</p>
                <div className={s.familyChoices}>
                  {(["MEMPHIS"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`${s.familyChoice} ${family === option ? s.familySelected : ""} ${s.memphisChoice}`}
                      onClick={() => { setFamily(option); setError(""); }}
                      aria-pressed={family === option}
                    >
                      <FamilyServerIcon family={option} size="large" />
                      <span className={s.familyChoiceText}>
                        <strong>{familyLabel[option]}</strong>
                        <small>Семья LONDO на сервере Memphis</small>
                      </span>
                      <span className={s.radioMark} aria-hidden="true">{family === option ? "✓" : ""}</span>
                    </button>
                  ))}
                </div>
                {currentFamilyApplication && <p className={s.inlineNotice}>У тебя уже есть активная заявка в <FamilyServerIcon family={currentFamilyApplication.family} size="inline" /> {familyLabel[currentFamilyApplication.family]}. Её статус отображается ниже.</p>}
                <div className={s.stepActions}>
                  <button type="button" className={s.secondaryAction} onClick={() => goTo(1)}>← Назад</button>
                  {currentFamilyApplication ? (
                    <a className={s.primaryAction} href="#my-applications">Посмотреть заявку <span aria-hidden="true">↓</span></a>
                  ) : (
                    <button type="button" className={s.primaryAction} disabled={!family} onClick={() => goTo(3)}>Продолжить <span aria-hidden="true">→</span></button>
                  )}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className={s.stepPanel}>
                <p className={s.stepEyebrow}>Шаг 3 · немного о тебе {family && <>· <FamilyServerIcon family={family} size="inline" /> {familyLabel[family]}</>}</p>
                <h2 className={s.stepTitle}>Как к тебе обращаться?</h2>
                <p className={s.stepDescription}>Укажи игровой ник и возраст вне игры. Команда увидит ответы только для рассмотрения заявки.</p>
                <form className={s.answerForm} onSubmit={(event) => collectAnswers(event, 4)}>
                  {profileFields.map((field) => {
                    const value = answers[field.key];
                    const isLong = field.key === "joinReason" || field.key === "discoverySource";
                    return (
                      <label className={s.field} key={field.key} htmlFor={`application-${field.key}`}>
                        <span className={s.fieldLabel}>{field.label}<span className={s.required}>Обязательно</span></span>
                        {isLong ? (
                          <textarea
                            id={`application-${field.key}`}
                            name={field.key}
                            required
                            maxLength={field.max}
                            rows={field.rows}
                            value={value}
                            onChange={(event) => setAnswers((previous) => ({ ...previous, [field.key]: event.target.value }))}
                            placeholder={field.key === "joinReason" ? "Напиши несколько слов о себе и о том, почему тебе близка LONDO…" : "Расскажи, где впервые услышал о LONDO…"}
                            aria-describedby={`${field.key}-hint`}
                          />
                        ) : (
                          <input
                            id={`application-${field.key}`}
                            name={field.key}
                            required
                            maxLength={field.max}
                            value={value}
                            type={field.key === "charactersScreenshotUrl" ? "url" : "text"}
                            min={field.key === "oocAge" ? 14 : undefined}
                            max={field.key === "oocAge" ? 99 : undefined}
                            inputMode={field.key === "oocAge" ? "numeric" : undefined}
                            pattern={field.key === "oocAge" ? "[0-9]{1,2}" : undefined}
                            onChange={(event) => setAnswers((previous) => ({ ...previous, [field.key]: event.target.value }))}
                            placeholder={field.key === "gameNicknameStatic" ? "Например, Londo_Family" : field.key === "oocAge" ? "Например, 18" : "https://…"}
                            aria-describedby={`${field.key}-hint`}
                          />
                        )}
                        <span className={s.fieldMeta} id={`${field.key}-hint`}>
                          <span>{field.hint}</span>
                          {(isLong || field.key === "charactersScreenshotUrl") && <span>{value.length}/{field.max}</span>}
                        </span>
                      </label>
                    );
                  })}
                  <div className={s.stepActions}>
                    <button type="button" className={s.secondaryAction} onClick={() => goTo(2)}>← К выбору семьи</button>
                    <button type="submit" className={s.primaryAction}>Продолжить <span aria-hidden="true">→</span></button>
                  </div>
                </form>
              </section>
            )}

            {step === 4 && (
              <section className={s.stepPanel}>
                <p className={s.stepEyebrow}>Шаг 4 · твой интерес к LONDO</p>
                <h2 className={s.stepTitle}>Почему хочешь к нам?</h2>
                <p className={s.stepDescription}>Пара предложений поможет команде понять, что тебе интересно. Здесь нет правильных или неправильных ответов.</p>
                <form className={s.answerForm} onSubmit={(event) => collectAnswers(event, 5)}>
                  {motivationFields.map((field) => {
                    const value = answers[field.key];
                    const isLong = field.key === "joinReason" || field.key === "discoverySource";
                    return (
                      <label className={s.field} key={field.key} htmlFor={`application-${field.key}`}>
                        <span className={s.fieldLabel}>{field.label}<span className={s.required}>Обязательно</span></span>
                        {isLong ? (
                          <textarea
                            id={`application-${field.key}`}
                            name={field.key}
                            required
                            maxLength={field.max}
                            rows={field.rows}
                            value={value}
                            onChange={(event) => setAnswers((previous) => ({ ...previous, [field.key]: event.target.value }))}
                            placeholder={field.key === "joinReason" ? "Напиши несколько слов о себе и о том, почему тебе близка LONDO…" : "Расскажи, где впервые услышал о LONDO…"}
                            aria-describedby={`${field.key}-hint`}
                          />
                        ) : (
                          <input
                            id={`application-${field.key}`}
                            name={field.key}
                            required
                            maxLength={field.max}
                            value={value}
                            type="url"
                            onChange={(event) => setAnswers((previous) => ({ ...previous, [field.key]: event.target.value }))}
                            placeholder="https://…"
                            aria-describedby={`${field.key}-hint`}
                          />
                        )}
                        <span className={s.fieldMeta} id={`${field.key}-hint`}>
                          <span>{field.hint}</span>
                          <span>{value.length}/{field.max}</span>
                        </span>
                      </label>
                    );
                  })}
                  <div className={s.stepActions}>
                    <button type="button" className={s.secondaryAction} onClick={() => goTo(3)}>← Назад</button>
                    <button type="submit" className={s.primaryAction}>К проверке <span aria-hidden="true">→</span></button>
                  </div>
                </form>
              </section>
            )}

            {step === 5 && family && (
              <section className={s.stepPanel}>
                <p className={s.stepEyebrow}>Шаг 5 · последний перед отправкой</p>
                <h2 className={s.stepTitle}>Проверь заявку</h2>
                <p className={s.stepDescription}>Убедись, что всё указано верно. Если нужно, вернись и измени ответы.</p>
                <dl className={s.reviewList}>
                  <div><dt>Семья</dt><dd><FamilyServerIcon family={family} size="inline" /> {familyLabel[family]}</dd></div>
                  {fields.map((field) => (
                    <div key={field.key}><dt>{field.label}</dt><dd>{answers[field.key]}</dd></div>
                  ))}
                </dl>
                <div className={s.reviewPrivacy}>После отправки статус появится в разделе «Мои заявки». Команда свяжется с тобой в Discord.</div>
                <div className={s.stepActions}>
                  <button type="button" className={s.secondaryAction} onClick={() => goTo(4)}>← Изменить ответы</button>
                  <button type="button" className={s.primaryAction} onClick={() => void submitApplication()} disabled={submitting} aria-busy={submitting}>
                    {submitting ? <><span className={s.spinner} aria-hidden="true" />Отправляем…</> : "Отправить заявку"}
                  </button>
                </div>
              </section>
            )}
          </div>

          <details className={s.optionalCheck} open={Boolean(callbackError || consentResult === "granted" || consentResult === "declined")}>
            <summary>
              <span><strong>Дополнительная проверка Discord</strong><small>Необязательно для подачи заявки</small></span>
              <span className={s.optionalChevron} aria-hidden="true">⌄</span>
            </summary>
            <div className={s.optionalBody}>
              <p>Можно разрешить команде проверить список серверов и роли Discord, чтобы ускорить рассмотрение. Без этого разрешения заявку всё равно можно отправить.</p>
              {needsRoleConsent && <p className={s.inlineNotice}>Разрешение на просмотр ролей истекло — его можно обновить.</p>}
              {callbackError && <p className={s.alertError} role="alert">{callbackError}</p>}
              {consent === "GRANTED" ? (
                <div className={s.optionalActions}>
                  <span className={s.checkBadge}>Разрешение активно</span>
                  <button type="button" className={s.textAction} onClick={() => void revokeConsent()} disabled={submitting}>Отозвать разрешение</button>
                </div>
              ) : (
                <button type="button" className={s.secondaryAction} onClick={() => void beginConsent()} disabled={consentBusy} aria-busy={consentBusy}>
                  {consentBusy ? "Открываем Discord…" : declined ? "Разрешить проверку" : "Подключить проверку"}
                </button>
              )}
              <p className={s.privacyNote}>Если согласие будет предоставлено, проверочные данные хранятся до 30 дней. Разрешение можно отозвать здесь.</p>
            </div>
          </details>
        </section>

      </div>

      <section className={s.applicationsSection} id="my-applications">
        <div className={s.applicationsHeading}>
          <div><p className={s.kicker}>Твой статус</p><h2>Мои заявки</h2><p className={s.applicationsIntro}>Здесь появятся решения и следующий шаг по каждой заявке.</p></div>
          <button type="button" className={s.refreshButton} onClick={() => void loadApplications()} disabled={applicationsLoading} aria-label="Обновить список заявок">Обновить</button>
        </div>
        {applicationsLoading ? (
          <div className={s.listLoading} role="status">Загружаем заявки…</div>
        ) : applicationsError ? (
          <div className={s.emptyState}>
            <p>{applicationsError}</p>
            <button type="button" className={s.textAction} onClick={() => void loadApplications()}>Попробовать ещё раз</button>
          </div>
        ) : applications.length ? (
          <div className={s.applicationList}>
            {applications.map((application) => {
              const parsed = parseApplicationAnswers(application.answers);
              const statusCopy: Record<string, string> = {
                NEW: "Команда рекрутов рассматривает заявку. Следи за сообщениями в Discord.",
                CALL: "Команда рекрутов пригласит тебя на обзвон в Discord.",
                ACCEPTED: "Заявка одобрена. Проверь Discord — там появится дальнейшая информация.",
                REJECTED: "Решение уже принято. Если появятся вопросы, свяжись с командой рекрутов LONDO в Discord.",
              };
              return (
                <article className={s.applicationCard} key={application.id}>
                  <div className={s.applicationTop}>
                    <div><span className={s.applicationFamily}><FamilyServerIcon family={application.family} size="inline" /> {familyLabel[application.family]}</span><p className={s.applicationDate}>Подана {new Date(application.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</p></div>
                    <span className={`${s.applicationStatus} ${application.status === "ACCEPTED" ? s.statusAccepted : application.status === "REJECTED" ? s.statusRejected : ""}`}>{applicationStatus[application.status] ?? "На рассмотрении"}</span>
                  </div>
                  <div className={s.applicationNext}><span className={`${s.nextMark} ${application.status === "ACCEPTED" ? s.nextAccepted : ""}`} aria-hidden="true">{application.status === "ACCEPTED" ? "✓" : application.status === "REJECTED" ? "i" : "·"}</span><p>{statusCopy[application.status] ?? "Статус заявки обновится здесь."}</p></div>
                  {parsed && <p className={s.applicationNickname}>Игровой ник: {parsed.gameNicknameStatic}</p>}
                </article>
              );
            })}
          </div>
        ) : (
          <div className={s.emptyState}>
            <span className={s.emptyMark} aria-hidden="true">↗</span>
            <h3>Заявок пока нет</h3>
            <p>Пройди короткие шаги выше — и здесь появится статус рассмотрения.</p>
          </div>
        )}
      </section>
    </div>
  );
}
