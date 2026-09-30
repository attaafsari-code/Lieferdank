"use client";

import { useState, useTransition } from "react";
import { Check } from "@/components/icons";
import { refreshPayoutStatusAction, startPayoutOnboardingAction } from "@/server/actions/driver";

export function PayoutSetup({ hasAccount, ready, buttonLabel }: { hasAccount: boolean; ready: boolean; buttonLabel?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (ready) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900">
        <Check className="h-4 w-4 text-brand" /> Dein Auszahlungskonto ist bereit.
      </p>
    );
  }

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
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
    </div>
  );
}
