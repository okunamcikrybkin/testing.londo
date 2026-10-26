"use client";

import { RankLabel } from "@/components/rank-label";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import type { SessionUser } from "@/lib/auth/session";
import type { RosterEntry } from "@/lib/roster/data";
import { DEFAULT_SORT, ROSTER_COLUMNS, nextRosterSort, selectRoster, type RosterSort } from "@/lib/roster/table";

type FamilyRosterProps = { family: "MEMPHIS"; user: SessionUser; roster: RosterEntry[] };
const voiceLabel = (seconds: bigint) => {
  const minutes = Number(seconds / BigInt(60));
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
};
const dateLabel = (value: string) => new Date(value).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function FamilyRoster({ family, user, roster }: FamilyRosterProps) {
  const familyPath = "/memphis";
  const [currentRoster, setCurrentRoster] = useState(roster);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RosterSort>(DEFAULT_SORT);
  const visibleRoster = useMemo(() => selectRoster(currentRoster, query, sort), [currentRoster, query, sort]);
  const awayCount = currentRoster.filter(member => member.afkUntil && new Date(member.afkUntil).getTime() > Date.now()).length;

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/roster/${family.toLowerCase()}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { roster?: Array<Omit<RosterEntry, "totalVoiceSeconds"> & { totalVoiceSeconds: string }> };
        if (!cancelled && Array.isArray(data.roster)) setCurrentRoster(data.roster.map(member => ({ ...member, totalVoiceSeconds: BigInt(member.totalVoiceSeconds) })));
      } catch {
        // Polling is quiet; the next interval repairs temporary failures.
      }
    };
    const interval = window.setInterval(() => { void refresh(); }, 5_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [family]);

  return (
    <div className="londo-page min-h-screen" data-ui-page="family-roster" data-family={family.toLowerCase()}>
      <Header user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={familyPath} className="londo-ui-button"><span aria-hidden="true">←</span> {family}</Link>
          <p className="londo-ui-tooltip">Панель рекрута <span aria-hidden="true">/</span> {family} <span aria-hidden="true">/</span> Состав</p>
        </div>

        <section className="londo-ui-surface mt-5 p-5 sm:p-7" aria-labelledby="roster-title">
          <header className="flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <p className="londo-ui-eyebrow">СОСТАВ СЕМЬИ · {family}</p>
              <h1 className="londo-ui-title" id="roster-title">Участники</h1>
              <p className="londo-ui-description">Состав, ранги, активность и баланс участников. Нажми на имя, чтобы открыть профиль.</p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Сводка состава">
              <div className="londo-roster-summary"><span>В составе</span><strong>{currentRoster.length}</strong></div>
              <div className="londo-roster-summary"><span>В отпуске</span><strong>{awayCount}</strong></div>
            </div>
          </header>

          <div className="londo-roster-toolbar">
            <label className="londo-ui-search">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
              <input className="londo-ui-search-input" aria-label="Поиск по составу" placeholder="Поиск по имени, нику или Discord ID" type="search" value={query} onChange={event => setQuery(event.target.value)} />
            </label>
            <label className="londo-roster-sort">
              <span>Сортировка</span>
              <select className="londo-ui-control" aria-label="Сортировка состава" value={`${sort.key}:${sort.direction}`} onChange={event => { const [key, direction] = event.target.value.split(":"); setSort({ key, direction } as RosterSort); }}>
                {ROSTER_COLUMNS.flatMap(column => (["desc", "asc"] as const).map(direction => <option key={`${column.key}:${direction}`} value={`${column.key}:${direction}`}>{column.label} {direction === "desc" ? "↓" : "↑"}</option>))}
              </select>
            </label>
            <p className="londo-roster-results" aria-live="polite">Показано <strong>{visibleRoster.length}</strong> из {currentRoster.length}</p>
          </div>

          {visibleRoster.length === 0 ? (
            <div className="londo-ui-empty mt-4" role="status">
              <strong>{query.trim() ? "Участники не найдены" : "Состав пока не синхронизирован"}</strong>
              {query.trim() ? "Измените поисковый запрос и попробуйте ещё раз." : "Данные появятся после синхронизации бота."}
            </div>
          ) : (
            <>
              <div className="londo-roster-desktop londo-ui-table-wrap mt-4">
                <table className="londo-ui-table">
                  <thead><tr>{ROSTER_COLUMNS.map(column => <th key={column.key} scope="col" aria-sort={sort.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => setSort(current => nextRosterSort(current, column.key))}><span>{column.label}</span>{sort.key === column.key && <span aria-hidden="true">{sort.direction === "desc" ? " ↓" : " ↑"}</span>}</button></th>)}</tr></thead>
                  <tbody>{visibleRoster.map(member => (
                    <tr key={member.discordUserId}>
                      <td>{member.profileId ? <Link className="londo-roster-name" href={`/profile/${member.profileId}`} aria-label={`Открыть профиль ${member.gameNickname ?? member.discordDisplayName}`}>{member.gameNickname ?? member.discordDisplayName}</Link> : <span className="londo-roster-name">{member.gameNickname ?? member.discordDisplayName}</span>}{member.afkUntil && <span className="londo-ui-badge ml-2" data-tone="warning" title={`Отпуск до ${dateLabel(member.afkUntil)}`}>Отпуск</span>}</td>
                      <td>{member.staticId ?? "—"}</td>
                      <td><span className="londo-roster-discord">{member.discordUserId}</span></td>
                      <td><span className="londo-roster-rank"><RankLabel roleId={member.rankRoleId} colors={member.rankRoleId && member.rankColor ? { [member.rankRoleId]: member.rankColor } : undefined}>{member.rankDisplayName ?? "Без ранга"}</RankLabel></span></td>
                      <td>{voiceLabel(member.totalVoiceSeconds)}</td>
                      <td>{member.balance}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="londo-roster-mobile">{visibleRoster.map(member => (
                <article className="londo-ui-surface londo-roster-mobile-card" key={member.discordUserId}>
                  <div className="londo-roster-mobile-top">
                    <div className="min-w-0">{member.profileId ? <Link className="londo-roster-name" href={`/profile/${member.profileId}`}>{member.gameNickname ?? member.discordDisplayName}</Link> : <p className="londo-roster-name">{member.gameNickname ?? member.discordDisplayName}</p>}<p className="londo-roster-discord">{member.discordUserId}</p></div>
                    <span className="londo-roster-rank"><RankLabel roleId={member.rankRoleId} colors={member.rankRoleId && member.rankColor ? { [member.rankRoleId]: member.rankColor } : undefined}>{member.rankDisplayName ?? "Без ранга"}</RankLabel></span>
                  </div>
                  {member.afkUntil && <span className="londo-ui-badge mt-3" data-tone="warning" title={`Отпуск до ${dateLabel(member.afkUntil)}`}>В отпуске до {dateLabel(member.afkUntil)}</span>}
                  <dl className="londo-roster-mobile-facts"><div><dt>Статик</dt><dd>{member.staticId ?? "—"}</dd></div><div><dt>Голос</dt><dd>{voiceLabel(member.totalVoiceSeconds)}</dd></div><div><dt>Баланс</dt><dd>{member.balance}</dd></div></dl>
                </article>
              ))}</div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
