import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { isDemoPayment } from "@/server/payments";
import { formatEuro } from "@/lib/format";
import { LogoMark } from "@/components/logo";
import { driverPublicName } from "@/server/services/drivers";
import { confirmDemoPaymentAction } from "@/server/actions/customer-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Testzahlung", robots: { index: false, follow: false } };

/**
 * Nachgebaute Bezahlmaske für den Testmodus. Im Echtbetrieb gibt es diese
 * Seite nicht – dort übernimmt Stripe Checkout mit Apple Pay, Google Pay,
 * und Karte.
 */
export default async function DemoPaymentPage({ params }: { params: Promise<{ paymentId: string }> }) {
  if (!isDemoPayment()) notFound();

  const { paymentId } = await params;
  const db = getDb();
  const payment = await db.payments.get(paymentId);
  if (!payment || payment.status !== "pending") notFound();

  const confirm = confirmDemoPaymentAction.bind(null, payment.id, true);
  const cancel = confirmDemoPaymentAction.bind(null, payment.id, false);

  if (payment.purpose === "card_order") {
    return (
      <DemoSheet
        title="Lieferdank-Karten"
        amount={formatEuro(payment.amountCents)}
        rows={[{ label: "Kartenbestellung", value: formatEuro(payment.amountCents) }]}
        confirm={confirm}
        cancel={cancel}
      />
    );
  }

  const tip = await db.tips.get(payment.referenceId);
  const driver = tip ? await db.driverProfiles.get(tip.driverId) : null;
  const user = driver ? await db.users.get(driver.userId) : null;
  if (!tip || !driver || !user) notFound();

  const name = driverPublicName(driver, user);

  return (
    <DemoSheet
      title={`Danke an ${name}`}
      amount={formatEuro(tip.grossCents)}
      rows={[{ label: "Trinkgeld", value: formatEuro(tip.grossCents) }]}
      confirm={confirm}
      cancel={cancel}
    />
  );
}

function DemoSheet({
  title,
  amount,
  rows,
  confirm,
  cancel,
}: {
  title: string;
  amount: string;
  rows: { label: string; value: string; strong?: boolean }[];
  confirm: () => Promise<void>;
  cancel: () => Promise<void>;
}) {
  return (
    <div className="flex min-h-dvh flex-col justify-center bg-brand-900 px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <p className="text-center text-[0.6875rem] font-bold tracking-[0.18em] text-white/50 uppercase">
          Test-Bezahlmaske
        </p>

        <div className="mt-4 rounded-3xl bg-white p-7 shadow-lg">
          <LogoMark className="mx-auto h-9 w-9" />
          <p className="mt-5 text-center text-sm text-ink-soft">{title}</p>
          <p className="mt-1 text-center text-[2.75rem] leading-none font-extrabold tracking-tight text-brand-900">
            {amount}
          </p>

          <dl className="mt-6 space-y-2 rounded-2xl bg-canvas px-4 py-3.5 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-ink-soft">{row.label}</dt>
                <dd className={row.strong ? "font-bold text-ink" : "font-semibold text-ink-soft"}>{row.value}</dd>
              </div>
            ))}
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
            Im Echtbetrieb stehen Karte sowie je nach Gerät Apple&nbsp;Pay und Google&nbsp;Pay bereit.
            <br />
            Es wird kein echtes Geld bewegt.
          </p>
        </div>
      </div>
    </div>
  );
}
