"use client";

import { useActionState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { completeResetAction } from "@/server/actions/auth";
import type { FormState } from "@/server/actions/form-state";

const initial: FormState = {};

export function NewPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(completeResetAction, initial);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      <FormField
        id="password"
        label="Neues Passwort"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        hint="Mindestens 8 Zeichen."
      />
      <FormField
        id="passwordRepeat"
        label="Neues Passwort wiederholen"
        type="password"
        autoComplete="new-password"
        error={errors.passwordRepeat}
      />

      {state.error && <FormAlert>{state.error}</FormAlert>}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Wird gespeichert …" : "Passwort speichern"}
      </button>
    </form>
  );
}
