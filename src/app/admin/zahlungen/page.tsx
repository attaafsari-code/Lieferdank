import { getDb } from "@/lib/db";
import { formatDateTime, formatEuro } from "@/lib/format";
import { AdminTitle, Empty, Table, Td } from "../ui";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "offen", succeeded: "bezahlt", failed: "fehlgeschlagen", refunded: "erstattet" };

export default async function AdminPayments() {
  const db = getDb();
  const [tips, drivers, payments] = await Promise.all([
    db.tips.findMany({ orderBy: "createdAt", desc: true, limit: 200 }),
    db.driverProfiles.findMany(),
    db.payments.findMany({ orderBy: "createdAt", desc: true, limit: 400 }),
  ]);
  const codeById = new Map(drivers.map((d) => [d.id, d.code]));
  const paymentById = new Map(payments.map((p) => [p.id, p]));

  return (
    <div>
      <AdminTitle title="Transaktionen" lead="Die letzten 200 Trinkgelder mit vollständiger Aufteilung." />
      {tips.length === 0 ? (
        <Empty>Noch keine Transaktionen.</Empty>
      ) : (
        <Table head={["Zeitpunkt", "Code", "Brutto", "Lieferant", "Plattform", "Payment*", "Auszahlung*", "Netto*", "Status", "Zahlart"]} minWidth="62rem">
          {tips.map((tip) => (
            <tr key={tip.id}>
              <Td>{formatDateTime(tip.createdAt)}</Td>
              <Td mono>{codeById.get(tip.driverId) ?? "—"}</Td>
              <Td>{formatEuro(tip.grossCents)}</Td>
              <Td>{formatEuro(tip.driverCents)}</Td>
              <Td>{formatEuro(tip.platformGrossFeeCents)}</Td>
              <Td>{formatEuro(tip.paymentProviderFeeCents)}</Td>
              <Td>{formatEuro(tip.payoutFeeCents)}</Td>
              <Td strong>{formatEuro(tip.platformNetRevenueCents)}</Td>
              <Td>{STATUS[tip.paymentStatus] ?? tip.paymentStatus}</Td>
              <Td>{paymentById.get(tip.paymentId)?.method ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-4 text-xs text-ink-faint">* Paymentkosten, Auszahlungskosten und Netto sind kalkuliert. Maßgeblich sind die Stripe-Abrechnungen.</p>
    </div>
  );
}
