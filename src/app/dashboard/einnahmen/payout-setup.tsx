"use client";

import { useState, useTransition } from "react";
import { Check } from "@/components/icons";
import { refreshPayoutStatus, startPayoutOnboarding } from "@/lib/actions/driver-actions";

export function PayoutSetup({ hasAccount, ready }: { hasAccount: boolean; ready: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (ready) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900">
        <Check className="h-4 w-4 text-brand" />
        Dein Auszahlungskonto ist bereit.
      </p>
    );
  }

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError(
          "Die Verbindung zum Zahlungsdienstleister hat nicht geklappt. Bitte später erneut versuchen.",
        );
      }
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(startPayoutOnboarding)}
          className="btn btn-primary flex-1"
        >
          {pending
            ? "Einen Moment …"
            : hasAccount
              ? "Einrichtung fortsetzen"
              : "Auszahlungskonto einrichten"}
        </button>
        {hasAccount && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(refreshPayoutStatus)}
            className="btn btn-ghost"
          >
            Status aktualisieren
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
