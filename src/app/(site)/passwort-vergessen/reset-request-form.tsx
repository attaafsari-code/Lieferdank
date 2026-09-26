"use client";

import { useActionState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { Check } from "@/components/icons";
import { requestPasswordReset, type ResetRequestState } from "@/lib/actions/auth-actions";

const initial: ResetRequestState = {};

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (state.sent) {
    return (
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50">
          <Check className="h-6 w-6 text-brand" />
        </span>
        <p className="mt-4 font-bold text-ink">E-Mail unterwegs</p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
          Falls es zu dieser Adresse ein Konto gibt, haben wir einen Link zum Zurücksetzen
          geschickt. Er ist eine Stunde gültig.
        </p>

        {state.devLink && (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-200 bg-brand-50 p-4 text-left">
            <p className="text-xs font-bold text-brand-900">
              Testmodus – kein E-Mail-Versand konfiguriert
            </p>
            <a
              href={state.devLink}
              className="mt-2 block break-all text-xs font-medium text-brand underline"
            >
              {state.devLink}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormField
        id="email"
        label="E-Mail"
        type="email"
        autoComplete="email"
        error={state.fieldErrors?.email}
      />

      {state.error && <FormAlert>{state.error}</FormAlert>}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Wird gesendet …" : "Link anfordern"}
      </button>
    </form>
  );
}
