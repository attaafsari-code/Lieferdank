"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { registerDriverAction } from "@/server/actions/auth";
import type { FormState } from "@/server/actions/form-state";

const initial: FormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerDriverAction, initial);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="firstName" label="Vorname" autoComplete="given-name" error={errors.firstName} />
        <FormField id="lastName" label="Nachname" autoComplete="family-name" error={errors.lastName} />
      </div>
      <p className="-mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
        Welcher Name öffentlich erscheint, entscheidest du selbst – standardmäßig nur der Vorname.
      </p>

      <FormField id="email" label="E-Mail" type="email" autoComplete="email" error={errors.email} />
      <FormField id="phone" label="Telefonnummer (optional)" type="tel" autoComplete="tel" error={errors.phone} hint="Nie öffentlich sichtbar." />
      <FormField
        id="password"
        label="Passwort"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        hint="Mindestens 8 Zeichen."
      />

      <Terms />
      {errors.terms && <p className="error-text">{errors.terms}</p>}
      {state.error && <FormAlert>{state.error}</FormAlert>}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Konto wird erstellt …" : "Danke-Code erstellen"}
      </button>
    </form>
  );
}

export function Terms({ driver = true }: { driver?: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-2xl bg-canvas p-4 text-[0.9375rem] leading-relaxed text-ink-soft">
      <input type="checkbox" name="terms" className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[color:var(--color-brand)]" />
      <span>
        Ich habe die{" "}
        <Link href="/legal/agb" className="font-semibold text-brand underline underline-offset-2">
          AGB
        </Link>{" "}
        und die{" "}
        <Link href="/legal/datenschutz" className="font-semibold text-brand underline underline-offset-2">
          Datenschutzhinweise
        </Link>{" "}
        gelesen.
        {driver && " Die Regeln meines Arbeitgebers bzw. Auftraggebers beachte ich selbst."}
      </span>
    </label>
  );
}
