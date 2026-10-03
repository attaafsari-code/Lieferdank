"use client";

import { useState, useTransition } from "react";
import { resendVerificationAction } from "@/server/actions/auth";
import type { FormState } from "@/server/actions/form-state";

/** Hinweis für Konten mit noch unbestätigter E-Mail-Adresse – mit „Link erneut senden“. */
export function EmailVerificationNotice({ email, requirement }: { email: string; requirement?: string }) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="no-print rounded-2xl border border-coral-100 bg-coral-50 px-5 py-4 text-sm text-ink">
      <p className="font-semibold">Bitte bestätige deine E-Mail-Adresse.</p>
      <p className="mt-1 leading-relaxed text-ink-soft">
        Wir haben dir einen Link an <span className="font-semibold break-all text-ink">{email}</span> geschickt.
        {requirement ? ` ${requirement}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || state.saved}
          onClick={() => startTransition(async () => setState(await resendVerificationAction()))}
          className="btn btn-ghost btn-sm"
        >
          {pending ? "Wird gesendet …" : state.saved ? "Link gesendet" : "Link erneut senden"}
        </button>
        {state.error && <span className="font-semibold text-coral-600">{state.error}</span>}
      </div>
      {state.devLink && (
        <a href={state.devLink} className="mt-3 block text-xs font-medium break-all text-brand underline">
          Testmodus ohne E-Mail-Versand: {state.devLink}
        </a>
      )}
    </div>
  );
}
