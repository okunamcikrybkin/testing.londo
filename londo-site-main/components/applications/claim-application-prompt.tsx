"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClaimApplicationPrompt({ id, family }: { id: string; family: "memphis" | "phoenix" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function claim() {
    setBusy(true);
    try {
      const response = await fetch("/api/applications/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, family }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Не удалось закрепить заявку.");
      router.replace(`/applications/${family}/${id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось закрепить заявку.");
      setBusy(false);
    }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="claim-application-title">
    <div className="londo-ui-surface londo-ui-surface-raised w-full max-w-md p-6 sm:p-7">
      <p className="londo-ui-eyebrow">РАБОТА С ЗАЯВКОЙ</p>
      <h2 id="claim-application-title" className="londo-ui-title mt-2 text-2xl">Закрепить заявку за собой?</h2>
      <p className="londo-ui-description mt-3">После подтверждения другие рекруты не смогут её рассматривать.</p>
      {error ? <p className="londo-ui-alert mt-4" data-tone="danger" role="alert">{error}</p> : null}
      <div className="mt-6 flex justify-end gap-3"><button type="button" className="londo-ui-button" disabled={busy} onClick={() => router.replace(`/applications/${family}/${id}`)}>Отмена</button><button type="button" className="londo-ui-button londo-ui-button-primary" disabled={busy} onClick={() => void claim()}>{busy ? "Закрепление..." : "Да, закрепить"}</button></div>
    </div>
  </div>;
}
