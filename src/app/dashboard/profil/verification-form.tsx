"use client";

import { useActionState } from "react";
import { Check } from "@/components/icons";
import { submitVerification } from "@/lib/actions/driver-actions";
import type { FormState } from "@/lib/actions/auth-actions";

const initial: FormState = {};

export function VerificationForm({ existingNote }: { existingNote: string | null }) {
  const [state, action, pending] = useActionState(submitVerification, initial);
  const error = state.fieldErrors?.documentNote;

  if (state.saved) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3.5 text-sm font-semibold text-brand-900">
        <Check className="h-4 w-4 text-brand" />
        Danke – wir schauen uns das an und melden uns per E-Mail.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="documentNote" className="label">
          Wie können wir deine Tätigkeit nachvollziehen?
        </label>
        <textarea
          id="documentNote"
          name="documentNote"
          rows={4}
          defaultValue={existingNote ?? ""}
          maxLength={500}
          aria-invalid={error ? "true" : undefined}
          placeholder="Zum Beispiel: Ich fahre seit März als Subunternehmer für einen DHL-Zustellstützpunkt in Köln. Dienstausweis und Arbeitsvertrag kann ich auf Anfrage zeigen."
          className="field resize-none"
        />
        <p className="hint">
          Ein Mensch liest das und meldet sich per E-Mail. Lade hier keine Ausweisdokumente
          hoch.
        </p>
        {error && <p className="error-text">{error}</p>}
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Wird gesendet …" : "Abzeichen anfragen"}
      </button>
    </form>
  );
}
