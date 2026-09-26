"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { loginAction } from "@/server/actions/auth";
import type { FormState } from "@/server/actions/form-state";

const initial: FormState = {};

export function LoginForm({ next, saveCode }: { next?: string; saveCode?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="weiter" value={next} />}
      {saveCode && <input type="hidden" name="saveCode" value={saveCode} />}

      <FormField id="email" label="E-Mail" type="email" autoComplete="email" error={state.fieldErrors?.email} />

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="label">
            Passwort
          </label>
          <Link href="/passwort-vergessen" className="mb-1.5 text-sm font-semibold text-brand hover:underline">
            Vergessen?
          </Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" className="field" />
      </div>

      {state.error && <FormAlert>{state.error}</FormAlert>}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Wird geprüft …" : "Anmelden"}
      </button>
    </form>
  );
}
