"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/form-field";
import { keepInputs } from "@/components/keep-inputs";
import { confirmNewsletterAction } from "@/server/actions/newsletter";
import type { FormState } from "@/server/actions/form-state";

const initial: FormState = {};

export function ConfirmNewsletterForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmNewsletterAction, initial);
  if (state.saved) return <p className="text-center font-semibold text-brand-900">Danke! Deine Anmeldung ist bestätigt.</p>;
  return (
    <form action={action} onSubmit={keepInputs(action)} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? "Einen Moment …" : "Anmeldung bestätigen"}</button>
    </form>
  );
}
