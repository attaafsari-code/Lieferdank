"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { loginUser, type FormState } from "@/lib/actions/auth-actions";

const initial: FormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginUser, initial);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormField id="email" label="E-Mail" type="email" autoComplete="email" />

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="label">
            Passwort
          </label>
          <Link
            href="/passwort-vergessen"
            className="mb-1.5 text-sm font-semibold text-brand hover:underline"
          >
            Vergessen?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="field"
        />
      </div>

      {state.error && <FormAlert>{state.error}</FormAlert>}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Wird geprüft …" : "Anmelden"}
      </button>
    </form>
  );
}
