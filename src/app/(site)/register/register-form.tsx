"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { registerDriver, type FormState } from "@/lib/actions/auth-actions";

const initial: FormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerDriver, initial);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormField
        id="name"
        label="Vor- und Nachname"
        autoComplete="name"
        error={errors.name}
        hint="Auf der Kundenseite zeigen wir standardmäßig nur deinen Vornamen."
      />
      <FormField id="email" label="E-Mail" type="email" autoComplete="email" error={errors.email} />
      <FormField
        id="phone"
        label="Telefonnummer (optional)"
        type="tel"
        autoComplete="tel"
        error={errors.phone}
      />
      <FormField
        id="password"
        label="Passwort"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        hint="Mindestens 8 Zeichen."
      />

      <label className="flex items-start gap-3 rounded-2xl bg-canvas p-4 text-[0.9375rem] leading-relaxed text-ink-soft">
        <input
          type="checkbox"
          name="terms"
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[color:var(--color-brand)]"
        />
        <span>
          Ich habe die{" "}
          <Link href="/legal/agb" className="font-semibold text-brand underline underline-offset-2">
            AGB
          </Link>{" "}
          und die{" "}
          <Link
            href="/legal/datenschutz"
            className="font-semibold text-brand underline underline-offset-2"
          >
            Datenschutzhinweise
          </Link>{" "}
          gelesen. Mir ist bewusst, dass ich die Regeln meines Arbeitgebers bzw.
          Auftraggebers selbst beachten muss.
        </span>
      </label>
      {errors.terms && <p className="error-text">{errors.terms}</p>}

      {state.error && <FormAlert>{state.error}</FormAlert>}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Konto wird erstellt …" : "Danke-Code erstellen"}
      </button>
    </form>
  );
}
