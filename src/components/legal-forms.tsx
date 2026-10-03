"use client";

import { useActionState, useState } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { cancellationAction, contactAction, reportAction, withdrawalAction, type LegalFormState } from "@/server/actions/legal";

const initial: LegalFormState = {};

/** Unsichtbares Feld gegen Bots – Menschen sehen und füllen es nicht. */
function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

function TextArea({ id, label, error, hint, maxLength, defaultValue }: {
  id: string; label: string; error?: string; hint?: string; maxLength: number; defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} name={id} rows={5} maxLength={maxLength} defaultValue={defaultValue}
        aria-invalid={error ? "true" : undefined} className="field min-h-32" />
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

/** Eingangsbestätigung auf der Seite – speicher- und druckbar (§ 312k Abs. 3, § 356a Abs. 4 BGB). */
function Receipt({ title, state, note }: { title: string; state: LegalFormState; note: string }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-[0.9375rem] leading-relaxed text-ink" role="status">
      <p className="font-bold text-brand-900">{title}</p>
      <p className="mt-1">Eingegangen am {state.receivedAt}.</p>
      {state.lines && state.lines.length > 0 && (
        <ul className="mt-3 space-y-1 text-ink-soft">
          {state.lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      <p className="mt-3 text-sm text-ink-soft">{note}</p>
      <button type="button" onClick={() => window.print()} className="btn btn-ghost btn-sm mt-4 no-print">
        Bestätigung drucken oder als PDF speichern
      </button>
    </div>
  );
}

export function ContactForms({ initialTopic, location }: { initialTopic: "anfrage" | "meldung"; location?: string }) {
  const [topic, setTopic] = useState(initialTopic);
  return (
    <div className="space-y-6">
      <fieldset className="flex flex-wrap gap-2" aria-label="Anliegen">
        <button type="button" onClick={() => setTopic("anfrage")} aria-pressed={topic === "anfrage"}
          className={`btn btn-sm ${topic === "anfrage" ? "btn-primary" : "btn-ghost"}`}>Frage oder Anliegen</button>
        <button type="button" onClick={() => setTopic("meldung")} aria-pressed={topic === "meldung"}
          className={`btn btn-sm ${topic === "meldung" ? "btn-primary" : "btn-ghost"}`}>Rechtswidrigen Inhalt melden</button>
      </fieldset>
      {topic === "anfrage" ? <ContactForm /> : <ReportForm location={location} />}
    </div>
  );
}

function ContactForm() {
  const [state, action, pending] = useActionState(contactAction, initial);
  const errors = state.fieldErrors ?? {};
  if (state.receivedAt) {
    return <Receipt title="Danke für deine Nachricht." state={state} note="Wir antworten dir per E-Mail. Eine Eingangsbestätigung ist unterwegs." />;
  }
  return (
    <form action={action} className="relative space-y-5" noValidate>
      <Honeypot />
      <FormField id="name" label="Name (optional)" autoComplete="name" error={errors.name} maxLength={100} />
      <FormField id="email" label="E-Mail-Adresse für die Antwort" type="email" autoComplete="email" error={errors.email} />
      <TextArea id="message" label="Dein Anliegen" maxLength={4000} error={errors.message} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? "Wird gesendet …" : "Nachricht senden"}</button>
    </form>
  );
}

function ReportForm({ location }: { location?: string }) {
  const [state, action, pending] = useActionState(reportAction, initial);
  const errors = state.fieldErrors ?? {};
  if (state.receivedAt) {
    return <Receipt title="Danke, deine Meldung ist eingegangen." state={state} note="Wir prüfen den Inhalt und teilen dir unsere Entscheidung per E-Mail mit." />;
  }
  return (
    <form action={action} className="relative space-y-5" noValidate>
      <Honeypot />
      <FormField id="location" label="Wo steht der Inhalt?" defaultValue={location} error={errors.location} maxLength={500}
        hint="Adresse der Danke-Seite oder Danke-Code; bei einer Nachricht in deinem Dashboard Datum und Uhrzeit." />
      <TextArea id="reason" label="Warum ist der Inhalt rechtswidrig?" maxLength={4000} error={errors.reason} />
      <FormField id="name" label="Dein Name" autoComplete="name" error={errors.name} maxLength={100} />
      <FormField id="email" label="Deine E-Mail-Adresse" type="email" autoComplete="email" error={errors.email} />
      <label className="flex items-start gap-3 rounded-2xl bg-canvas p-4 text-[0.9375rem] leading-relaxed text-ink-soft">
        <input type="checkbox" name="goodFaith" className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[color:var(--color-brand)]" />
        <span>Ich bin in gutem Glauben davon überzeugt, dass die Angaben in dieser Meldung richtig und vollständig sind.</span>
      </label>
      {errors.goodFaith && <p className="error-text">{errors.goodFaith}</p>}
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? "Wird gesendet …" : "Meldung absenden"}</button>
    </form>
  );
}

export function WithdrawalForm() {
  const [state, action, pending] = useActionState(withdrawalAction, initial);
  const errors = state.fieldErrors ?? {};
  if (state.receivedAt) {
    return <Receipt title="Dein Widerruf ist eingegangen." state={state} note="Eine Eingangsbestätigung mit diesem Inhalt haben wir dir per E-Mail geschickt." />;
  }
  return (
    <form action={action} className="relative space-y-5" noValidate>
      <Honeypot />
      <FormField id="name" label="Dein Name" autoComplete="name" error={errors.name} maxLength={100} />
      <FormField id="contract" label="E-Mail-Adresse deines Lieferdank-Kontos oder dein Danke-Code" error={errors.contract} maxLength={200} />
      <FormField id="email" label="E-Mail-Adresse für die Eingangsbestätigung" type="email" autoComplete="email" error={errors.email} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? "Wird gesendet …" : "Widerruf bestätigen"}</button>
    </form>
  );
}

export function CancellationForm() {
  const [state, action, pending] = useActionState(cancellationAction, initial);
  const [type, setType] = useState<"ordentlich" | "ausserordentlich">("ordentlich");
  const errors = state.fieldErrors ?? {};
  if (state.receivedAt) {
    return <Receipt title="Deine Kündigung ist eingegangen." state={state} note="Eine Bestätigung mit diesem Inhalt haben wir dir per E-Mail geschickt." />;
  }
  return (
    <form action={action} className="relative space-y-5" noValidate>
      <Honeypot />
      <div>
        <label htmlFor="contract" className="label">Welchen Vertrag möchtest du kündigen?</label>
        <select id="contract" name="contract" className="field" defaultValue="konto">
          <option value="konto">Lieferdank-Konto (gesamte Nutzung)</option>
          <option value="trinkgeld">Nur die Trinkgeld-Funktion</option>
        </select>
      </div>
      <div>
        <label htmlFor="type" className="label">Art der Kündigung</label>
        <select id="type" name="type" className="field" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="ordentlich">Ordentliche Kündigung</option>
          <option value="ausserordentlich">Außerordentliche Kündigung</option>
        </select>
      </div>
      {type === "ausserordentlich" && <TextArea id="reason" label="Kündigungsgrund" maxLength={1000} error={errors.reason} />}
      <FormField id="name" label="Dein Name" autoComplete="name" error={errors.name} maxLength={100} />
      <FormField id="account" label="E-Mail-Adresse deines Lieferdank-Kontos oder dein Danke-Code" error={errors.account} maxLength={200} />
      <FormField id="date" label="Beenden zum (optional)" type="date" error={errors.date}
        hint="Ohne Datum gilt die Kündigung zum frühestmöglichen Zeitpunkt – bei Lieferdank sofort." />
      <FormField id="email" label="E-Mail-Adresse für die Kündigungsbestätigung" type="email" autoComplete="email" error={errors.email} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? "Wird gesendet …" : "jetzt kündigen"}</button>
    </form>
  );
}
