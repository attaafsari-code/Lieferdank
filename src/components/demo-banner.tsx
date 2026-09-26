import { isDemoPayment } from "@/lib/payments";
import { isDemoDatabase } from "@/lib/db";

/**
 * Sichtbarer Hinweis, solange die Anwendung nicht im Echtbetrieb läuft,
 * sowie eine harte Warnung bei fehlender Produktionskonfiguration.
 */
export function DemoBanner() {
  const missingSecret =
    process.env.NODE_ENV === "production" && (process.env.AUTH_SECRET ?? "").length < 32;

  if (missingSecret) {
    return (
      <div className="no-print bg-coral-600 px-4 py-2 text-center text-xs font-bold text-white">
        Konfigurationsfehler: AUTH_SECRET fehlt oder ist zu kurz. Anmeldungen schlagen fehl.
      </div>
    );
  }

  const demoPayment = isDemoPayment();
  const demoDb = isDemoDatabase();
  if (!demoPayment && !demoDb) return null;

  // Kurz halten: Auf dem Handy soll der Balken eine Zeile bleiben.
  const label = demoPayment
    ? "Testmodus · Es fließt kein echtes Geld"
    : "Testmodus · Lokale Testdatenbank";

  return (
    <div className="no-print bg-brand-900 px-4 py-2 text-center text-[0.6875rem] font-semibold tracking-wide text-white/90">
      {label}
    </div>
  );
}
