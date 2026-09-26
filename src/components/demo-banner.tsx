import { isDemoDatabase } from "@/lib/db";
import { isDemoPayment } from "@/server/payments";

/** Sichtbarer Hinweis im Testmodus, harte Warnung bei fehlender Produktionskonfiguration. */
export function DemoBanner() {
  if (process.env.NODE_ENV === "production" && (process.env.AUTH_SECRET ?? "").length < 32) {
    return (
      <div className="no-print bg-coral-600 px-4 py-2 text-center text-xs font-bold text-white">
        Konfigurationsfehler: AUTH_SECRET fehlt oder ist zu kurz. Anmeldungen schlagen fehl.
      </div>
    );
  }

  const demoPayment = isDemoPayment();
  if (!demoPayment && !isDemoDatabase()) return null;

  return (
    <div className="no-print bg-brand-900 px-4 py-2 text-center text-[0.6875rem] font-semibold tracking-wide text-white/90">
      {demoPayment ? "Testmodus · Es fließt kein echtes Geld" : "Testmodus · Lokale Testdatenbank"}
    </div>
  );
}
