"use client";
import { useEffect, useState, type FormEvent } from "react";
import { applyRequest } from "./client";
import { FamilyServerIcon } from "@/components/family-server-icon";
import s from "./ui.module.css";

type Entry = { id: string; guildId: string; name: string; inviteUrl: string | null; enabled: boolean; createdAt: string };
type WatchlistValue = { guildId: string; name: string; inviteUrl: string; enabled: boolean };
const empty: WatchlistValue = { guildId: "", name: "", inviteUrl: "", enabled: true };

export function Watchlist() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState<WatchlistValue>(empty);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const data = await applyRequest<Entry[]>({ operation: "WATCHLIST" });
    setRows(data);
  }

  useEffect(() => {
    let active = true;
    void applyRequest<Entry[]>({ operation: "WATCHLIST" }).then(data => {
      if (active) setRows(data);
    }).catch(() => {
      if (active) setError("Не удалось загрузить список. Проверьте соединение с ботом и повторите попытку.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function run(body: object, successMessage: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await applyRequest(body);
      await load();
      setEditing(null);
      setValue(empty);
      setNotice(successMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить операцию. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void run({ operation: "WATCHLIST_SAVE", id: editing, value }, editing ? "Изменения сохранены." : "Сервер добавлен в список.");
  }

  return <div className={s.watchlist}>
    <div className={s.watchlistIntro}>
      <div>
        <h2 className={s.adminSectionTitle}>Список серверов</h2>
        <p className={s.adminHelp}>Проверка сверяет участника с Discord-серверами из этого списка. Настройки применяются для <FamilyServerIcon family="MEMPHIS" size="inline" /> MEMPHIS.</p>
      </div>
      <span className={s.countBadge}>{rows.length} {rows.length === 1 ? "сервер" : rows.length > 1 && rows.length < 5 ? "сервера" : "серверов"}</span>
    </div>

    {error && <p className={s.error} role="alert">{error}</p>}
    {notice && <p className={s.success} role="status">{notice}</p>}

    <form onSubmit={save} className={s.watchlistForm}>
      <div className={s.formHeading}>
        <div><h3 className={s.formTitle}>{editing ? "Изменить сервер" : "Добавить сервер"}</h3><p className={s.adminHelp}>Укажите сервер, по которому система будет подтверждать участие пользователя.</p></div>
      </div>
      <fieldset disabled={busy} className={s.form}>
        <label className={s.field}>ID сервера Discord<input required className={s.input} value={value.guildId} inputMode="numeric" pattern="[0-9]{17,20}" onChange={e => setValue({ ...value, guildId: e.target.value })} placeholder="Например, 123456789012345678"/><small>Числовой ID можно скопировать в Discord при включённом режиме разработчика.</small></label>
        <label className={s.field}>Название сервера<input required maxLength={100} className={s.input} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} placeholder="Например, LONDO Memphis"/></label>
        <label className={s.field}>Пригласительная ссылка <span className={s.optionalLabel}>необязательно</span><input type="url" className={s.input} value={value.inviteUrl} onChange={e => setValue({ ...value, inviteUrl: e.target.value })} placeholder="https://discord.gg/..."/></label>
        <label className={s.toggle}><input type="checkbox" checked={value.enabled} onChange={e => setValue({ ...value, enabled: e.target.checked })}/><span><strong>Использовать при проверке</strong><small>Выключенный сервер останется в списке, но учитываться не будет.</small></span></label>
        <div className={s.actions}><button className={s.primary} type="submit" disabled={busy}>{busy ? "Сохраняем…" : editing ? "Сохранить изменения" : "Добавить сервер"}</button>{editing && <button type="button" className={s.button} disabled={busy} onClick={() => { setEditing(null); setValue(empty); }}>Отмена</button>}</div>
      </fieldset>
    </form>

    <section className={s.serverList} aria-labelledby="discord-watchlist-title">
      <div className={s.listHeading}><div><h3 id="discord-watchlist-title" className={s.formTitle}>Подключённые серверы</h3><p className={s.adminHelp}>Управляйте участием серверов в проверке и корректируйте их данные.</p></div></div>
      {loading ? <p className={s.emptyState} role="status">Загружаем список серверов…</p> : rows.length ? <div className={s.entries}>{rows.map(row => <article key={row.id} className={s.entry}>
        <div className={s.entryHeading}><div><h4>{row.name}</h4><p className={s.entryId}>{row.guildId}</p></div><span className={`${s.statusBadge} ${row.enabled ? s.statusEnabled : s.statusDisabled}`}>{row.enabled ? "Участвует в проверке" : "Выключен"}</span></div>
        <dl className={s.entryDetails}><div><dt>Приглашение</dt><dd>{row.inviteUrl ? <a href={row.inviteUrl} target="_blank" rel="noopener noreferrer">Открыть ссылку ↗</a> : "Не добавлено"}</dd></div><div><dt>Добавлен</dt><dd>{new Date(row.createdAt).toLocaleDateString("ru-RU")}</dd></div></dl>
        <div className={s.actions}><button type="button" disabled={busy} className={s.button} onClick={() => { setEditing(row.id); setValue({ ...row, inviteUrl: row.inviteUrl ?? "" }); }}>Изменить</button><button type="button" disabled={busy} className={s.button} onClick={() => void run({ operation: "WATCHLIST_SAVE", id: row.id, value: { ...row, enabled: !row.enabled } }, row.enabled ? "Сервер исключён из проверок." : "Сервер снова участвует в проверке.")}>{row.enabled ? "Выключить" : "Включить"}</button><button type="button" disabled={busy} className={s.danger} onClick={() => { if (window.confirm(`Удалить ${row.name} из списка проверки?`)) void run({ operation: "WATCHLIST_DELETE", id: row.id }, "Сервер удалён из списка."); }}>Удалить</button></div>
      </article>)}</div> : <div className={s.emptyState}><strong>Список пока пуст</strong><span>Добавьте первый Discord-сервер, чтобы проверки могли находить участников.</span></div>}
    </section>
  </div>;
}
