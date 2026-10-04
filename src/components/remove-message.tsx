"use client";

import { useState, useTransition } from "react";
import { removeMessageAction } from "@/server/actions/driver";

/** Entfernt eine erhaltene Nachricht nach Rückfrage. Das Danke selbst bleibt gezählt. */
export function RemoveMessage({ thankYouId }: { thankYouId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="shrink-0 text-xs font-semibold text-ink-faint hover:text-coral-600">
        Entfernen
      </button>
    );
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
      <span className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await removeMessageAction(thankYouId);
              if (result.error) setError(result.error);
            })
          }
          className="text-coral-600 hover:underline"
        >
          {pending ? "Wird entfernt …" : "Ja, entfernen"}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="text-ink-soft hover:underline">
          Nein
        </button>
      </span>
      {error && <span role="alert" className="font-medium text-coral-600">{error}</span>}
    </span>
  );
}
