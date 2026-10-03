"use client";

import { useRef, useState, useTransition } from "react";
import { formatEuroShort } from "@/lib/format";
import { TIP_OPTIONS_CENTS } from "@/lib/money";
import { startTipAction } from "@/server/actions/customer-flow";

/** Freiwilliges Trinkgeld nach einem kostenlosen Danke; derselbe Checkout wie auf der QR-Seite. */
export function OptionalTip({ code, tipReady }: { code: string; tipReady: boolean }) {
  const [finished, setFinished] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);

  function pay(cents: number) {
    if (active.current) return;
    active.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await startTipAction(code, cents);
        if (result && !result.ok) setError(result.error ?? "Trinkgeld ist gerade nicht verfügbar.");
      } catch {
        setError("Die Verbindung ist unterbrochen. Bitte versuch es erneut.");
      } finally {
        active.current = false;
      }
    });
  }

  if (finished) return <p className="mt-7 text-center text-sm text-ink-soft">Alles erledigt. Danke für deine Wertschätzung!</p>;

  return (
    <section className="mt-8 rounded-2xl border border-line bg-white p-5 text-center shadow-xs">
      <h2 className="font-bold text-brand-900">Möchtest du zusätzlich ein Trinkgeld geben?</h2>
      {!tipReady && <p className="mt-2 text-sm text-ink-soft">Trinkgeld ist für diesen Lieferanten noch nicht eingerichtet.</p>}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {TIP_OPTIONS_CENTS.map((cents) => (
          <button key={cents} type="button" disabled={!tipReady || pending} onClick={() => pay(cents)} className="btn btn-ghost min-h-12 px-1 disabled:opacity-50">
            {formatEuroShort(cents)}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-coral-600">{error}</p>}
      <button type="button" onClick={() => setFinished(true)} className="mt-4 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft underline underline-offset-2 hover:text-brand">
        Nein, danke – fertig
      </button>
    </section>
  );
}
