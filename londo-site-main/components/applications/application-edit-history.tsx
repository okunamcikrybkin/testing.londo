import { applicationAnswerLabels } from "@/lib/applications/edit-policy";
import type { Prisma } from "@prisma/client";

type Entry = { id: string; createdAt: Date; metadata: Prisma.JsonValue; actor: { displayName: string } | null };
export function ApplicationEditHistory({ entries }: { entries: Entry[] }) {
  return <section className="londo-card mt-5 rounded-3xl p-6 sm:p-8">
    <h2 className="text-xl font-semibold">История изменений</h2>
    {entries.length ? <ol className="mt-5 space-y-6">{entries.map(entry => {
      const metadata = entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata : {};
      const changes = Array.isArray(metadata.changes) ? metadata.changes : [];
      return <li key={entry.id} className="border-l border-accent/40 pl-4">
        <p className="text-sm">{entry.actor?.displayName ?? (typeof metadata.editorDisplayName === "string" ? metadata.editorDisplayName : "Сотрудник")} изменил заявку</p>
        <p className="mt-1 text-xs text-muted">{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(entry.createdAt)}</p>
        <dl className="mt-3 space-y-3">{changes.map((change, index) => {
          if (!change || typeof change !== "object" || Array.isArray(change) || typeof change.field !== "string" || !Object.hasOwn(applicationAnswerLabels, change.field)) return null;
          return <div key={index} className="break-words text-sm"><dt className="text-muted">{applicationAnswerLabels[change.field as keyof typeof applicationAnswerLabels]}</dt><dd className="mt-1 whitespace-pre-wrap"><span className="text-muted">{typeof change.before === "string" ? change.before : "—"}</span>{" → "}{typeof change.after === "string" ? change.after : "—"}</dd></div>;
        })}</dl>
      </li>;
    })}</ol> : <p className="mt-4 text-sm text-muted">Изменений пока нет.</p>}
  </section>;
}
