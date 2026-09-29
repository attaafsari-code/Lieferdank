"use client";

import { useState, useTransition } from "react";
import { deleteDriverAccountAction, setActiveAction } from "@/server/actions/driver";

export function ActiveToggle({ active }: { active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start justify-between gap-4">
      <span>
        <span className="block font-semibold text-ink">
          {active ? "Dein Code ist aktiv" : "Dein Code ist pausiert"}
        </span>
        <span className="mt-1 block text-[0.9375rem] leading-relaxed text-ink-soft">
          {active
            ? "Kunden können dir Danke sagen und Trinkgeld geben."
            : "Gescannte Codes zeigen einen Hinweis. Du erhältst kein Danke."}
        </span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => setActiveAction(!active))}
        className="btn btn-ghost btn-sm shrink-0"
      >
        {active ? "Pausieren" : "Aktivieren"}
      </button>
    </div>
  );
}

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-semibold text-coral-600 underline underline-offset-2"
      >
        Konto löschen
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-coral-50 p-5">
      <p className="font-bold text-coral-600">Konto wirklich löschen?</p>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink">
        Dein Profil und dein Danke-Code werden dauerhaft deaktiviert und deine persönlichen
        Profildaten entfernt. Zahlungsdaten und die Stripe-Konto-Zuordnung bleiben
        für Erstattungen, Streitfälle und gesetzliche Aufbewahrung erhalten. Offene
        Zahlungen und Auszahlungen
        verwaltet Stripe weiterhin auf deinem verbundenen Konto.
      </p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteDriverAccountAction())}
          className="btn btn-coral btn-sm"
        >
          {pending ? "Wird gelöscht …" : "Endgültig löschen"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="btn btn-ghost btn-sm"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
