"use client";
import { useActionState } from "react";
import { keepInputs } from "@/components/keep-inputs";
import type { RewardDefinition } from "@/lib/db/types";
import { saveDraftAction } from "./actions";
export function RewardDraft({ threshold, initial }: { threshold: number; initial: RewardDefinition | null }) {
  const [state, action, pending] = useActionState(saveDraftAction, { updatedAt: initial?.updatedAt ?? "" });
  return <form action={action} onSubmit={keepInputs(action)} className="space-y-3 rounded-2xl border border-line bg-white p-5"><h3 className="font-bold text-brand-900">Reward · {threshold.toLocaleString("de-DE")} Danke</h3><p className="text-sm text-ink-soft">Privater Entwurf. Speichern aktiviert weder ein Angebot noch eine Beanspruchung oder Ausgabe.</p>
    <input type="hidden" name="threshold" value={threshold} /><input type="hidden" name="updatedAt" value={state.updatedAt ?? ""} />
    <label className="block text-sm font-semibold">Interner Inhalt<textarea name="contentDraft" maxLength={1000} className="field mt-1" defaultValue={initial?.contentDraft ?? ""} /></label>
    <label className="block text-sm font-semibold">Interne Bedingungen<textarea name="conditionsDraft" maxLength={4000} className="field mt-1" defaultValue={initial?.conditionsDraft ?? ""} /></label>
    <label className="block text-sm font-semibold">Änderungsgrund<input name="reason" required minLength={3} maxLength={250} className="field mt-1" /></label>
    {state.error && <p role="alert" className="text-sm text-coral-600">{state.error}</p>}{state.saved && <p role="status" className="text-sm text-brand">Entwurf gespeichert.</p>}
    <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Speichert …" : "Privaten Entwurf speichern"}</button>
  </form>;
}
