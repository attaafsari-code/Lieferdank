"use client";

import { useState, useTransition } from "react";
import { Check } from "@/components/icons";
import { refreshPayoutStatusAction, startPayoutOnboardingAction } from "@/server/actions/driver";

export function PayoutSetup({
  hasAccount,
  ready,
  buttonLabel,
  manageUrl = null,
  hints = false,
}: {
  hasAccount: boolean;
  ready: boolean;
  buttonLabel?: string;
  /** Kurzer Wegweiser durch das Stripe-Formular; im Testmodus überflüssig. */
  hints?: boolean;
  /** Stripe-Dashboard für Standard-Konten; null im Testmodus. */
  manageUrl?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  if (ready) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900">
          <Check className="h-4 w-4 text-brand" /> Dein Auszahlungskonto ist bereit.
        </p>
        {manageUrl && (
          <>
            {/* Fertige Standard-Konten verwaltet der Lieferant selbst bei Stripe – Hosted Onboarding ist kein Bearbeiten-Flow. */}
            <a href={manageUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full sm:w-auto">
              Bei Stripe anmelden
            </a>
            <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
              Bankverbindung, persönliche Angaben und Auszahlungsplan änderst du direkt in deinem Stripe-Konto. Dort siehst du
              auch Guthaben und Auszahlungen.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button type="button" disabled={pending} onClick={() => run(startPayoutOnboardingAction)} className="btn btn-primary flex-1">
          {pending ? "Einen Moment …" : buttonLabel ?? (hasAccount ? "Einrichtung fortsetzen" : "Auszahlungskonto einrichten")}
        </button>
        {hasAccount && (
          <button type="button" disabled={pending} onClick={() => run(refreshPayoutStatusAction)} className="btn btn-ghost">
            Status aktualisieren
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {hints && (
        <div className="mt-4 text-[0.8125rem] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">Gut zu wissen, bevor es zu Stripe geht</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Welche Angaben Pflicht sind, legt Stripe für dein Konto fest und zeigt es im Formular an.</li>
            <li>Hast du keine USt-IdNr., kannst du das Feld leer lassen, solange Stripe es nicht als Pflichtfeld markiert.</li>
            <li>
              Soll deine Telefonnummer privat bleiben, achte bei „Öffentliche Details“ auf die Option „Telefonnummer auf Belegen
              und Rechnungen anzeigen“.
            </li>
            <li>Lass die Auszahlung auf „Automatisch“, damit dein Trinkgeld von selbst auf dein Konto kommt.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
