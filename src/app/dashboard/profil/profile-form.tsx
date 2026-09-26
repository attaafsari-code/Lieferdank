"use client";

import { useActionState, useState } from "react";
import type { NameDisplay } from "@/lib/db/types";
import { MAX_CUSTOM_NAME_LENGTH, NAME_DISPLAY_OPTIONS, dativeName, publicName } from "@/lib/names";
import { DELIVERY_PROVIDERS, PROVIDER_GROUP_LABELS } from "@/lib/providers";
import { FormAlert, FormField } from "@/components/form-field";
import { Check } from "@/components/icons";
import { updateProfileAction } from "@/server/actions/driver";
import type { FormState } from "@/server/actions/form-state";

const initial: FormState = {};

type Props = {
  firstName: string;
  lastName: string;
  phone: string | null;
  nameDisplay: NameDisplay;
  customName: string | null;
  providerId: string | null;
  providerPublic: boolean;
  tagline: string | null;
  bio: string | null;
  city: string | null;
  notifyOnTip: boolean;
};

export function ProfileForm(props: Props) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  const errors = state.fieldErrors ?? {};

  const [first, setFirst] = useState(props.firstName);
  const [last, setLast] = useState(props.lastName);
  const [mode, setMode] = useState<NameDisplay>(props.nameDisplay);
  const [custom, setCustom] = useState(props.customName ?? "");
  const shown = publicName(first, last, mode, custom || null);

  return (
    <form action={action} className="space-y-10">
      <section className="space-y-5">
        <h2 className="text-[1.0625rem] font-extrabold text-brand-900">Name</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="firstName" label="Vorname" defaultValue={props.firstName} error={errors.firstName} onChange={setFirst} />
          <FormField id="lastName" label="Nachname" defaultValue={props.lastName} error={errors.lastName} onChange={setLast} />
        </div>

        <fieldset>
          <legend className="label">Was sehen Kunden?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {NAME_DISPLAY_OPTIONS.map((option) => {
              const example = publicName(first, last, option.id, custom || null);
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 transition ${
                    mode === option.id ? "border-brand bg-brand-50" : "border-line bg-white hover:border-brand-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="nameDisplay"
                    value={option.id}
                    checked={mode === option.id}
                    onChange={() => setMode(option.id)}
                    className="h-4 w-4 accent-[color:var(--color-brand)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    {option.id !== "custom" && <span className="block text-xs text-ink-soft">„{example}“</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {mode === "custom" && (
          <div>
            <FormField
              id="customName"
              label="Dein Anzeigename"
              defaultValue={custom}
              placeholder="z. B. Herr Müller"
              error={errors.customName}
              maxLength={MAX_CUSTOM_NAME_LENGTH}
              onChange={setCustom}
            />
          </div>
        )}
        {mode !== "custom" && <input type="hidden" name="customName" value={custom} />}

        <p className="rounded-2xl bg-canvas px-4 py-3 text-sm text-ink-soft">
          Kundenseite: <span className="font-bold text-brand-900">„Sag {dativeName(shown)} Danke ❤“</span>
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-[1.0625rem] font-extrabold text-brand-900">Über dich</h2>
        <FormField
          id="tagline"
          label="Kurzer persönlicher Text (optional)"
          defaultValue={props.tagline ?? ""}
          placeholder="z. B. Seit 6 Jahren in eurem Viertel unterwegs."
          hint="Steht unter deinem Namen auf der Kundenseite. Max. 80 Zeichen."
          maxLength={80}
          error={errors.tagline}
        />
        <div>
          <label htmlFor="bio" className="label">
            Beschreibung (optional)
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            maxLength={280}
            defaultValue={props.bio ?? ""}
            placeholder="Ein paar Sätze über dich – was dir an deiner Arbeit Freude macht."
            className="field resize-none"
          />
          <p className="hint">Erscheint weiter unten auf deiner Kundenseite. Max. 280 Zeichen.</p>
          {errors.bio && <p className="error-text">{errors.bio}</p>}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-[1.0625rem] font-extrabold text-brand-900">Lieferdienst</h2>
        <div>
          <label htmlFor="providerId" className="label">
            Für wen fährst du? <span className="font-medium text-ink-faint">optional</span>
          </label>
          <select id="providerId" name="providerId" defaultValue={props.providerId ?? ""} className="field">
            <option value="">Keine Angabe</option>
            {(Object.keys(PROVIDER_GROUP_LABELS) as (keyof typeof PROVIDER_GROUP_LABELS)[]).map((group) => (
              <optgroup key={group} label={PROVIDER_GROUP_LABELS[group]}>
                {DELIVERY_PROVIDERS.filter((provider) => provider.group === group).map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="hint">Nur als Text („unterwegs für DHL“), ohne fremde Logos. Wir prüfen die Angabe nicht.</p>
        </div>
        <Checkbox name="providerPublic" label="Lieferdienst öffentlich anzeigen" defaultChecked={props.providerPublic} />
      </section>

      <section className="space-y-5">
        <h2 className="text-[1.0625rem] font-extrabold text-brand-900">Privat</h2>
        <p className="-mt-3 text-sm text-ink-soft">Diese Angaben sieht nie ein Kunde.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="phone" label="Telefon (optional)" type="tel" defaultValue={props.phone ?? ""} error={errors.phone} />
          <FormField id="city" label="Stadt / Region (optional)" defaultValue={props.city ?? ""} error={errors.city} />
        </div>
        <Checkbox name="notifyOnTip" label="E-Mail bei jedem Trinkgeld" defaultChecked={props.notifyOnTip} />
      </section>

      {state.error && <FormAlert>{state.error}</FormAlert>}

      <div className="sticky bottom-24 z-10 flex items-center gap-4 rounded-2xl border border-line bg-white/95 p-3 shadow-md backdrop-blur md:bottom-4">
        <button type="submit" disabled={pending} className="btn btn-primary flex-1 sm:flex-none">
          {pending ? "Wird gespeichert …" : "Profil speichern"}
        </button>
        {state.saved && !pending && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-brand">
            <Check className="h-4 w-4" /> Gespeichert
          </span>
        )}
      </div>
    </form>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[0.9375rem] font-medium text-ink">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-5 w-5 rounded accent-[color:var(--color-brand)]" />
      {label}
    </label>
  );
}
