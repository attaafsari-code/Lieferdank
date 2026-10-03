"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "@/components/icons";
import { TIP_FEE_SUMMARY } from "@/lib/legal-content";
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
  const [immediateStart, setImmediateStart] = useState(false);
  // Ohne Stripe-Konto ist die Trinkgeld-Funktion noch nicht vereinbart: Erst dieser Klick schließt den entgeltlichen Vertrag.
  const needsContract = !hasAccount;

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
      {needsContract && (
        <div className="mb-4 space-y-2 rounded-2xl border border-line bg-canvas p-4 text-[0.8125rem] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">Trinkgeld-Funktion – das Wichtigste vor der Aktivierung</p>
          <p>
            Kunden können dir über deinen Danke-Code Trinkgeld geben. Stripe wickelt die Zahlung direkt auf deinem eigenen
            Stripe-Konto ab und zahlt sie nach deinem Auszahlungsplan aus.
          </p>
          <p>
            Preis: Je erhaltenem Trinkgeld behält Lieferdank eine Gebühr ein ({TIP_FEE_SUMMARY}). Weitere Kosten berechnet
            Lieferdank nicht. Stripe berechnet seine Zahlungs- und gegebenenfalls Auszahlungskosten separat.
          </p>
          <p>
            Laufzeit: unbefristet, ohne Mindestlaufzeit, jederzeit kündbar. Du hast ein 14-tägiges{" "}
            <Link href="/legal/agb#widerruf" className="font-semibold text-brand underline underline-offset-2">Widerrufsrecht</Link>; es gelten
            die <Link href="/legal/agb" className="font-semibold text-brand underline underline-offset-2">AGB</Link>.
          </p>
          <label className="flex items-start gap-3 pt-1 text-ink">
            <input
              type="checkbox"
              checked={immediateStart}
              onChange={(event) => setImmediateStart(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[color:var(--color-brand)]"
            />
            <span>
              Ich verlange ausdrücklich, dass Lieferdank vor Ablauf der Widerrufsfrist mit der Trinkgeld-Funktion beginnt. Mir
              ist bekannt, dass ich bei einem Widerruf einen anteiligen Betrag für die bis dahin erbrachten Leistungen zahle.
            </span>
          </label>
        </div>
      )}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          disabled={pending || (needsContract && !immediateStart)}
          onClick={() => run(() => startPayoutOnboardingAction({ immediateStart }))}
          className="btn btn-primary flex-1"
        >
          {pending ? "Einen Moment …" : needsContract ? "Trinkgeld zahlungspflichtig aktivieren" : buttonLabel ?? "Einrichtung fortsetzen"}
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
            <li>
              Branche, Website und Beschreibung haben wir für dich ausgefüllt. Du musst sie bei Stripe nur bestätigen und
              nichts daran ändern.
            </li>
            <li>
              Selbst angeben musst du nur Persönliches: Geburtsdatum, Anschrift und Bankverbindung. Manchmal bittet Stripe
              zusätzlich um ein Ausweisfoto.
            </li>
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
