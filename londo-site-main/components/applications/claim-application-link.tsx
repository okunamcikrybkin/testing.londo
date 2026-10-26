"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClaimApplicationLink({ id, family, href, claimed, owned }: { id: string; family: "memphis" | "phoenix"; href: string; claimed: boolean; owned: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/applications/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, family }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Не удалось закрепить заявку.");
      router.push(href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось закрепить заявку.");
      setBusy(false);
    }
  }

  if (owned) return <Link href={href} className="londo-ui-button londo-ui-button-primary shrink-0">Открыть заявку</Link>;
  if (claimed) return <span className="londo-ui-badge" data-tone="warning">Заявка уже закреплена</span>;

  return <>
    <button type="button" className="londo-ui-button londo-ui-button-primary shrink-0" onClick={() => setOpen(true)}>Открыть заявку</button>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="claim-application-title">
      <div className="londo-ui-surface londo-ui-surface-raised w-full max-w-md p-6 sm:p-7">
        <p className="londo-ui-eyebrow">РАБОТА С ЗАЯВКОЙ</p>
        <h2 id="claim-application-title" className="londo-ui-title mt-2 text-2xl">Взять заявку на себя?</h2>
        <p className="londo-ui-description mt-3">После подтверждения заявка закрепится за вами, и другие рекруты не смогут её рассматривать.</p>
        {error ? <p className="londo-ui-alert mt-4" data-tone="danger" role="alert">{error}</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="londo-ui-button" onClick={() => setOpen(false)} disabled={busy}>Отмена</button>
          <button type="button" className="londo-ui-button londo-ui-button-primary" onClick={() => void claim()} disabled={busy}>{busy ? "Закрепление..." : "Да, взять заявку"}</button>
        </div>
      </div>
    </div> : null}
  </>;
}
