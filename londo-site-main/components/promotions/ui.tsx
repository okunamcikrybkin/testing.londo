"use client";
import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import styles from "./promotions.module.css";

export type Family = "MEMPHIS";
export type Criterion = { text: string; isRequired: boolean };
export type Question = { label: string; placeholder: string; type: "SHORT" | "PARAGRAPH"; required: boolean; minLength: number; maxLength: number };
export type Rank = { id?: string; family?: Family; name: string; description: string; discordRoleId: string; sortOrder: number; isActive: boolean; isPosition: boolean; removePreviousRank: boolean; criteria: Criterion[]; questions: Question[] };
export type Settings = { title: string; description: string; isEnabled: boolean; discordChannelId: string; discordMessageId: string | null };
export type Application = { id: string; discordUserId: string; rankId: string; rankName: string; currentRank: string | null; status: string; identitySnapshot: { username?: string; displayName: string; gameNickname: string | null; staticId: string | null }; answers: { label: string; value: string }[]; criteriaSnapshot: Criterion[]; createdAt: string; reviewedAt: string | null; reviewedByDiscordId: string | null; rejectionReason: string | null; lastError: string | null };
export type Data = { settings: Settings; ranks: Rank[]; applications: Application[]; nextCursor: string | null };
export type Options = { roles: { id: string; name: string }[]; channels: { id: string; name: string }[] };
export type Run = (body: object) => Promise<boolean>;

export function Icon({ name, size = 18 }: { name: "arrow" | "back" | "settings" | "refresh" | "search" | "plus" | "list" | "clock" | "check" | "close" | "up" | "down" | "discord"; size?: number }) {
  if (name === "discord") return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.27 5.33A16.6 16.6 0 0 0 15.13 4c-.18.32-.4.75-.54 1.1a15.3 15.3 0 0 0-5.18 0A10.3 10.3 0 0 0 8.86 4a16.5 16.5 0 0 0-4.14 1.34C1.84 9.05 1.2 12.66 1.52 16.22A16.7 16.7 0 0 0 6.6 18.7c.36-.5.68-1.03.96-1.58a10.7 10.7 0 0 1-1.51-.73c.13-.1.25-.2.37-.3a11.9 11.9 0 0 0 10.16 0c.12.11.24.21.37.3-.48.29-.99.53-1.52.74.28.55.6 1.08.96 1.57a16.6 16.6 0 0 0 5.08-2.47c.4-4.17-.67-7.75-2.56-10.9ZM8.52 13.98c-.95 0-1.73-.88-1.73-1.96s.76-1.96 1.73-1.96 1.75.88 1.73 1.96-.76 1.96-1.73 1.96Zm6.96 0c-.95 0-1.73-.88-1.73-1.96s.76-1.96 1.73-1.96 1.75.88 1.73 1.96-.76 1.96-1.73 1.96Z" /></svg>;
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />, back: <path d="M19 12H5m6-6-6 6 6 6" />, settings: <><path d="m9 3-.7 2.2-2 .9L4 5.6 2 9l1.7 1.7v2.6L2 15l2 3.4 2.3-.5 2 .9L9 21h4l.7-2.2 2-.9 2.3.5 2.3.5 2-3.4-1.7-1.7v-2.6L20 9l-2-3.4-2.3.5-2-.9L13 3Z" /><circle cx="11" cy="12" r="3" /></>, refresh: <><path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5" /></>, search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>, plus: <path d="M12 5v14M5 12h14" />, list: <><rect x="5" y="4" width="14" height="17" rx="3" /><path d="M9 3h6v3H9zM9 11h6m-6 4h4" /></>, clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, check: <path d="m5 12 4 4L19 6" />, close: <path d="m6 6 12 12M6 18 18 6" />, up: <path d="m6 14 6-6 6 6" />, down: <path d="m6 10 6 6 6-6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const statuses: Record<string, string> = { PENDING: "Ожидает", APPROVING: "Выдача роли", APPROVED: "Одобрена", REJECTED: "Отклонена", CANCELLED: "Отменена" };
export function Badge({ status }: { status: string }) { return <span className={styles.badge} data-status={status}><span />{statuses[status] ?? status}</span>; }
export function Field({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  const id = useId();
  function labelControl(node: ReactNode): ReactNode { if (!isValidElement(node)) return node; const element = node as ReactElement<{ children?: ReactNode; id?: string; "aria-describedby"?: string }>; if (["input", "select", "textarea"].includes(String(element.type))) return cloneElement(element, { id, "aria-describedby": hint ? `${id}-hint` : undefined }); return element.props.children ? cloneElement(element, { children: Children.map(element.props.children, labelControl) }) : element; }
  return <div className={styles.field}><label htmlFor={id}>{title}</label>{Children.map(children, labelControl)}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
export function Toggle({ title, hint, value, onChange }: { title: string; hint?: string; value: boolean; onChange: (value: boolean) => void }) { return <label className={styles.toggle}><span><strong>{title}</strong>{hint && <small>{hint}</small>}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><span className={styles.switch} aria-hidden="true" /></label>; }
export function Empty({ title, description, children }: { title: string; description: ReactNode; children?: ReactNode }) { return <div className={styles.empty}><span className={styles.emptyIcon}><Icon name="list" size={26} /></span><h2>{title}</h2><p>{description}</p>{children}</div>; }
export function Section({ title, description, children, aside }: { title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode }) { return <section className={styles.section}><div className={styles.sectionHead}><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{aside}</div>{children}</section>; }
export function date(value: string) { return `${new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} (МСК)`; }
export function memberName(app: Application) { return app.identitySnapshot.gameNickname || app.identitySnapshot.displayName; }
export function move<T>(items: T[], index: number, direction: number) { const next = [...items]; if (index + direction < 0 || index + direction >= next.length) return items; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; }
