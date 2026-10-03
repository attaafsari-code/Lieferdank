/** Hinweis, solange ein Rechtstext noch nicht final ist (derzeit: fehlende Telefonnummer in den AGB). */
export function DraftNotice() {
  return (
    <div className="mb-10 rounded-2xl border border-dashed border-coral bg-coral-50 p-5">
      <p className="font-bold text-coral-600">Entwurf – noch nicht rechtsverbindlich</p>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink">
        Diese Bedingungen sind noch nicht endgültig: Für Verträge mit Verbrauchern fehlt noch die Telefonnummer des
        Anbieters. Bis dahin ist die Trinkgeld-Funktion nicht für den regulären Betrieb freigegeben.
      </p>
    </div>
  );
}
