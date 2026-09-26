/** Deutlicher Hinweis, dass ein Rechtstext noch nicht final geprüft ist. */
export function DraftNotice() {
  return (
    <div className="mb-10 rounded-2xl border border-dashed border-coral bg-coral-50 p-5">
      <p className="font-bold text-coral-600">Entwurf – noch nicht rechtsverbindlich</p>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink">
        Dieser Text ist ein Entwurf für den Testbetrieb. Vor dem öffentlichen Start mit
        echten Zahlungen muss er durch eine Rechtsberatung geprüft und um die tatsächlichen
        Angaben ergänzt werden. Die Platzhalter in eckigen Klammern sind zu ersetzen.
      </p>
    </div>
  );
}
