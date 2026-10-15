"use client";
import { useActionState } from "react";
import { enableDriverAction } from "@/server/actions/customer";
import { keepInputs } from "@/components/keep-inputs";
export function DriverActivation({ firstName, lastName }: { firstName: string; lastName: string }) {
  const [state, action, pending] = useActionState(enableDriverAction, {});
  return <details className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-semibold text-brand">Als Zusteller starten</summary>
    <form action={action} onSubmit={keepInputs(action)} className="mt-4 space-y-3"><p className="text-sm text-ink-soft">Dein bestehendes Konto und deine gespeicherten Zusteller bleiben erhalten. Dazu bekommst du deinen persönlichen Danke-Code.</p>
      <label className="block text-sm">Vorname<input name="firstName" required maxLength={60} defaultValue={firstName} autoComplete="given-name" className="input mt-1" /></label>
      <label className="block text-sm">Nachname<input name="lastName" required maxLength={60} defaultValue={lastName} autoComplete="family-name" className="input mt-1" /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="acceptedTerms" required className="mt-1" />Ich habe die AGB und Datenschutzhinweise gelesen und prüfe die Regeln meines Arbeitgebers selbst.</label>
      {state.error && <p role="alert" className="error-text">{state.error}</p>}
      {state.fieldErrors && <p role="alert" className="error-text">{Object.values(state.fieldErrors).join(" ")}</p>}
      <button disabled={pending} className="btn btn-primary">{pending ? "Wird eingerichtet …" : "Danke-Code erstellen"}</button>
    </form></details>;
}
