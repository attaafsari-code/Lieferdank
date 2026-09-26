"use client";

import { useActionState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { registerCustomerAction } from "@/server/actions/auth";
import type { FormState } from "@/server/actions/form-state";
import { Terms } from "../../register/register-form";

const initial: FormState = {};

export function CustomerRegisterForm({ saveCode }: { saveCode?: string }) {
  const [state, action, pending] = useActionState(registerCustomerAction, initial);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {saveCode && <input type="hidden" name="saveCode" value={saveCode} />}
      <FormField id="firstName" label="Vorname (optional)" autoComplete="given-name" error={errors.firstName} />
      <FormField id="email" label="E-Mail" type="email" autoComplete="email" error={errors.email} />
      <FormField id="password" label="Passwort" type="password" autoComplete="new-password" error={errors.password} hint="Mindestens 8 Zeichen." />
      <Terms driver={false} />
      {errors.terms && <p className="error-text">{errors.terms}</p>}
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Konto wird erstellt …" : saveCode ? "Konto erstellen & speichern" : "Konto erstellen"}
      </button>
    </form>
  );
}
