/** Platzhalter, solange eine Seite im angemeldeten Bereich ihre Daten lädt. */
export function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Wird geladen …</span>
      <div className="h-8 w-48 animate-pulse rounded-xl bg-brand-50" />
      <div className="h-32 animate-pulse rounded-3xl bg-white shadow-xs" />
      <div className="h-32 animate-pulse rounded-3xl bg-white shadow-xs" />
    </div>
  );
}
