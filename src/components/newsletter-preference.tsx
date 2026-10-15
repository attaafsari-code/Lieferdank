"use client";
import { useActionState } from "react";
import { newsletterAction } from "@/server/actions/newsletter";
import { keepInputs } from "@/components/keep-inputs";
export function NewsletterPreference({ status, available }: { status: string; available: boolean }) {
  const [state, action, pending] = useActionState(newsletterAction, {});
  if (!available && status !== "confirmed" && status !== "pending") return null;
  return <details className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-semibold text-brand">Newsletter (freiwillig)</summary>
    <form action={action} onSubmit={keepInputs(action)} className="mt-3 space-y-3"><p className="text-sm text-ink-soft">Neuigkeiten von LieferDank per E-Mail. Erst nach Bestätigung des E-Mail-Links angemeldet. Jederzeit hier abmelden; unabhängig von deinem Konto.</p>
      {status === "confirmed" ? <><p className="text-sm">Du bist angemeldet.</p><input type="hidden" name="mode" value="revoke" /><button className="btn btn-ghost" disabled={pending}>Newsletter abbestellen</button></> : <>
        {status === "pending" && <p className="text-sm">Bitte bestätige den Link in deinem Postfach. Noch kein aktives Abonnement.</p>}
        {available && <><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="consent" required className="mt-1" />Ich möchte den LieferDank-Newsletter erhalten.</label><button className="btn btn-primary" disabled={pending}>{pending ? "Einen Moment …" : "Bestätigungs-E-Mail anfordern"}</button></>}
      </>}
      {state.error && <p role="alert" className="error-text">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm">{status === "confirmed" ? "Einstellung gespeichert." : "Bitte prüfe dein Postfach bzw. deinen aktuellen Anmeldestatus."}</p>}
    </form></details>;
}
