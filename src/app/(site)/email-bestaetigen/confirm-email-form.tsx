"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert } from "@/components/form-field";
import { keepInputs } from "@/components/keep-inputs";
import { confirmEmailAction } from "@/server/actions/auth";
import type { FormState } from "@/server/actions/form-state";

const initial: FormState = {};

export function ConfirmEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmEmailAction, initial);

  if (state.saved) {
    return (
      <div className="space-y-5 text-center">
        <p className="font-semibold text-brand-900">Danke! Deine E-Mail-Adresse ist bestätigt.</p>
        <Link href="/login" className="btn btn-primary w-full">
          Weiter
        </Link>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={keepInputs(action)} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Einen Moment …" : "E-Mail-Adresse bestätigen"}
      </button>
    </form>
  );
}
