import { notFound } from "next/navigation";
import { getStore } from "@/lib/db";
import { isDemoPayment } from "@/lib/payments";
import { formatEuro } from "@/lib/format";
import { LogoMark } from "@/components/logo";
import { confirmDemoPayment } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * Nachgebaute Bezahlmaske für den Testmodus.
 * Bewusst als eigene Seite: So ist der komplette Ablauf inklusive Abbruch
 * testbar, ohne echtes Geld zu bewegen.
 */
export default async function DemoPaymentPage({
  params,
}: {
  params: Promise<{ tipId: string }>;
}) {
  if (!isDemoPayment()) notFound();

  const { tipId } = await params;
  const store = getStore();
  const tip = await store.getTipById(tipId);
  if (!tip) notFound();

  const driver = await store.getDriverById(tip.driverId);
  if (!driver) notFound();

  const confirm = confirmDemoPayment.bind(null, tip.id, true);
  const cancel = confirmDemoPayment.bind(null, tip.id, false);

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-brand-900 px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <p className="text-center text-[0.6875rem] font-bold tracking-[0.18em] text-white/50 uppercase">
          Test-Bezahlmaske
        </p>

        <div className="mt-4 rounded-3xl bg-white p-7 shadow-lg">
          <LogoMark className="mx-auto h-9 w-9" />

          <p className="mt-5 text-center text-sm text-ink-soft">
            Danke an {driver.displayName}
          </p>
          <p className="mt-1 text-center text-[2.75rem] leading-none font-extrabold tracking-tight text-brand-900">
            {formatEuro(tip.grossCents)}
          </p>

          <dl className="mt-6 space-y-2 rounded-2xl bg-canvas px-4 py-3.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">{driver.displayName} erhält</dt>
              <dd className="font-bold text-ink">{formatEuro(tip.driverCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Zahlungsabwicklung &amp; Lieferdank</dt>
              <dd className="font-semibold text-ink-soft">
                {formatEuro(tip.platformGrossFeeCents)}
              </dd>
            </div>
          </dl>

          <div className="mt-6 space-y-2.5">
            <form action={confirm}>
              <button type="submit" className="btn btn-primary w-full">
                Zahlung erfolgreich simulieren
              </button>
            </form>
            <form action={cancel}>
              <button type="submit" className="btn btn-ghost w-full">
                Abbrechen
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-ink-faint">
            Im Echtbetrieb stehen hier Apple&nbsp;Pay, Google&nbsp;Pay und Karte.
            <br />
            Es wird kein echtes Geld bewegt.
          </p>
        </div>
      </div>
    </div>
  );
}
