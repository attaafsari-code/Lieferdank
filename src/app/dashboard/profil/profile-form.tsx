"use client";

import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Check } from "@/components/icons";
import { DELIVERY_PROVIDERS } from "@/lib/providers";
import { updateProfile } from "@/lib/actions/driver-actions";
import type { FormState } from "@/lib/actions/auth-actions";

const initial: FormState = {};

export function ProfileForm({
  displayName,
  providerId,
  city,
}: {
  displayName: string;
  providerId: string | null;
  city: string | null;
}) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  const errors = state.fieldErrors ?? {};
  const saved = state.saved === true;

  return (
    <form action={action} className="space-y-5">
      <FormField
        id="displayName"
        label="Anzeigename für Kunden"
        defaultValue={displayName}
        error={errors.displayName}
        hint="Vorname reicht. Du musst deinen vollen Namen nicht zeigen."
      />

      <div>
        <label htmlFor="providerId" className="label">
          Aktueller Zustelldienst <span className="font-medium text-ink-faint">optional</span>
        </label>
        <select
          id="providerId"
          name="providerId"
          defaultValue={providerId ?? ""}
          className="field"
        >
          <option value="">Keine Angabe</option>
          {DELIVERY_PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
        <p className="hint">
          Wird als Text angezeigt („unterwegs für DHL“). Wir verwenden keine fremden Logos
          und prüfen die Angabe nicht.
        </p>
      </div>

      <FormField
        id="city"
        label="Stadt (optional)"
        defaultValue={city ?? ""}
        error={errors.city}
      />

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Wird gespeichert …" : "Änderungen speichern"}
        </button>
        {saved && !pending && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-brand">
            <Check className="h-4 w-4" /> Gespeichert
          </span>
        )}
      </div>
    </form>
  );
}
