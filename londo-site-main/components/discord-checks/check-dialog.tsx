"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { applyRequest } from "./client";
import { ROLE_BATCH_LIMIT, hasFreshRoles, type GuildResult } from "@/lib/discord-checks/policy";
import { roleMessage } from "@/lib/discord-checks/role-display";
import s from "./ui.module.css";

type Result = {
  candidate: string;
  discordId: string;
  status: string;
  checkedAt: string | null;
  previous: boolean;
  guilds: (GuildResult & { matched: boolean })[];
  matches: number;
};

const messages: Record<string, string> = {
  CONSENT_REQUIRED: "Кандидат не дал согласие, отозвал его или срок согласия истёк.",
  RECONSENT_REQUIRED: "Разрешение Discord истекло или отозвано. Требуется повторное согласие кандидата.",
  RATE_LIMITED: "Discord ограничил частоту запросов. Повторите позже.",
  UNAVAILABLE: "Discord временно недоступен.",
  MISSING_GUILDS_SCOPE: "Нет разрешения на список серверов.",
  SCOPE_UNAVAILABLE: "Discord не предоставил доступ.",
  RUNNING: "Проверка выполняется.",
  NOT_CHECKED: "Проверка ещё не выполнялась.",
  INCOMPLETE_GUILDS: "Не удалось получить весь ответ Discord. Повторите позже.",
};

export function CheckDialog({ applicationId, finalized }: { applicationId: string; finalized: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Все");
  const [loadingRoles, setLoadingRoles] = useState<string[]>([]);
  const roleRequest = useRef(false);

  async function load(fresh: boolean) {
    setBusy(true);
    setError("");
    try {
      let result = await applyRequest<Result>({ operation: fresh ? "CHECK" : "RESULT", applicationId });
      if (!fresh && !finalized && result.status === "NOT_CHECKED") {
        result = await applyRequest<Result>({ operation: "CHECK", applicationId });
      }
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка проверки");
      if (fresh) {
        try { setData(await applyRequest<Result>({ operation: "RESULT", applicationId })); }
        catch { setData(null); }
      }
    } finally {
      setBusy(false);
    }
  }

  async function roles(guildId?: string) {
    if (roleRequest.current || busy || finalized) return;
    roleRequest.current = true;
    setBusy(true);
    setError("");
    setLoadingRoles(guildId ? [guildId] : (data?.guilds.filter((guild) => guild.matched && !hasFreshRoles(guild)).slice(0, ROLE_BATCH_LIMIT).map((guild) => guild.id) ?? []));
    try {
      setData(await applyRequest<Result>({ operation: guildId ? "ROLES" : "WATCHLIST_ROLES", applicationId, ...(guildId ? { guildId } : {}) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка загрузки ролей.");
    } finally {
      roleRequest.current = false;
      setBusy(false);
      setLoadingRoles([]);
    }
  }

  const filteredGuilds = data?.guilds.filter((guild) =>
    guild.name.toLowerCase().includes(search.toLowerCase()) &&
    (filter === "Все" || (filter === "Совпадения" ? guild.matched : !guild.matched)),
  ) ?? [];

  return (
    <div className="mt-4">
      <button className={s.button} onClick={() => { dialog.current?.showModal(); void load(false); }}>Проверить Discord</button>
      <dialog ref={dialog} className={s.dialog} aria-labelledby="discord-check-title">
        <header className={s.dialogHeader}>
          <div>
            <p className={s.dialogEyebrow}>Панель рекрута · Проверка кандидата</p>
            <h2 id="discord-check-title">Проверка Discord</h2>
          </div>
          <button className={s.closeButton} onClick={() => dialog.current?.close()}>Закрыть</button>
        </header>
        {error && <p className={s.error} role="status">{error}</p>}
        {data && <div className={s.dialogContent}>
          <section className={s.candidateCard}>
            <span className={s.candidateAvatar} aria-hidden="true">{data.candidate.slice(0, 1).toUpperCase()}</span>
            <div className={s.candidateInfo}>
              <h3>{data.candidate}</h3>
              <p>Discord ID <span>{data.discordId}</span></p>
            </div>
            <span className={data.status === "SUCCESS" ? s.statusSuccess : s.statusNeutral}>
              {messages[data.status] ?? (data.status === "SUCCESS" ? "Проверка выполнена" : "Проверка недоступна")}
            </span>
          </section>

          <section className={s.summaryGrid} aria-label="Итоги проверки">
            <div><span>{data.previous ? "Предыдущая проверка" : "Дата проверки"}</span><strong>{data.checkedAt ? new Date(data.checkedAt).toLocaleString("ru-RU") : "Не проводилась"}</strong></div>
            <div><span>Серверов проверено</span><strong>{data.guilds.length}</strong></div>
            <div><span>Совпадений со списком</span><strong>{data.matches}</strong></div>
          </section>

          <p className={s.helpBox}>Здесь показаны данные, которые вернул Discord API. Совпадение помогает рекрутеру при рассмотрении заявки, но не принимает решение автоматически. Роли загружаются отдельно по запросу; кэш действует 5 минут.</p>

          <div className={s.toolbar}>
            <div className={s.actionGroup}>
              <button className={s.primaryButton} disabled={busy || finalized} onClick={() => void load(true)}>{busy ? "Проверка…" : "Обновить данные"}</button>
              <button className={s.button} disabled={busy || finalized || !data.guilds.some((guild) => guild.matched)} onClick={() => void roles()}>Проверить роли совпадений</button>
            </div>
            <span className={s.muted}>До {ROLE_BATCH_LIMIT} серверов за запрос.{finalized ? " Заявка завершена." : ""}</span>
          </div>

          <div className={s.listTools}>
            <label className={s.searchField}>Поиск сервера<input className={s.input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Начните вводить название" /></label>
            <div className={s.filterGroup} aria-label="Фильтр серверов">
              {["Все", "Совпадения", "Остальные"].map((item) => <button key={item} className={filter === item ? s.filterSelected : s.filterButton} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
          </div>

          <div className={s.guildGrid}>
            {filteredGuilds.map((guild) => <article className={guild.matched ? `${s.guildCard} ${s.guildMatched}` : s.guildCard} key={guild.id}>
              <div className={s.guildHeading}>
                {guild.icon ? <Image unoptimized src={guild.icon} width={44} height={44} alt="" className={s.guildIcon} /> : <span className={s.guildIconFallback}>{guild.name.slice(0, 1).toUpperCase()}</span>}
                <div><h3>{guild.name}</h3><p>ID сервера · {guild.id}</p></div>
                {guild.matched && <span className={s.matchBadge}>В списке проверки</span>}
              </div>
              <p className={s.roleStatus} role="status">{loadingRoles.includes(guild.id) ? "Загружаем роли…" : roleMessage(guild)}</p>
              <div className={s.guildFooter}>
                <button className={s.button} disabled={busy || finalized} onClick={() => void roles(guild.id)}>{loadingRoles.includes(guild.id) ? "Загрузка…" : "Показать роли"}</button>
                <div className={s.roleMeta}>
                  {guild.roleCheckedAt && <span>Обновлено {new Date(guild.roleCheckedAt).toLocaleString("ru-RU")}</span>}
                  {guild.roleRetryAt && <span>Повтор доступен {new Date(guild.roleRetryAt).toLocaleString("ru-RU")}</span>}
                  {guild.roleSource === "BOT" && <span>Данные предоставлены ботом LONDO</span>}
                </div>
              </div>
            </article>)}
            {!filteredGuilds.length && <p className={s.emptyResults}>Серверы по заданным условиям не найдены.</p>}
          </div>
        </div>}
      </dialog>
    </div>
  );
}
