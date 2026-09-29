import { requireAdmin } from "@/server/guards";
import { getDb } from "@/lib/db";
import { formatDateTime, formatEuro } from "@/lib/format";
import { AdminTitle, Empty, Table, Td } from "../ui";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "offen", succeeded: "bezahlt", failed: "fehlgeschlagen", refunded: "erstattet", review_required: "Abgleich nötig" };

export default async function AdminPayments() {
  await requireAdmin();
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
        <Table head={["Zeitpunkt", "Code", "Kunde zahlte", "Fahrer vor Stripe-Kosten", "Lieferdank-Gebühr", "Status", "Zahlart"]} minWidth="48rem">
          {tips.map((tip) => (
            <tr key={tip.id}>
              <Td>{formatDateTime(tip.createdAt)}</Td>
              <Td mono>{codeById.get(tip.driverId) ?? "—"}</Td>
              <Td>{formatEuro(tip.grossCents)}</Td>
              <Td>{formatEuro(tip.driverCents)}</Td>
              <Td>{formatEuro(tip.platformGrossFeeCents)}</Td>
              <Td>{STATUS[tip.paymentStatus] ?? tip.paymentStatus}{tip.paymentStatus === "review_required" && paymentById.get(tip.paymentId)?.failureReason ? ` · ${paymentById.get(tip.paymentId)?.failureReason}` : ""}</Td>
              <Td>{paymentById.get(tip.paymentId)?.method ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-4 text-xs text-ink-faint">Stripe berechnet Zahlungs- und Auszahlungskosten beim Connected Account. Die tatsächlichen Stripe-Abrechnungen sind maßgeblich.</p>
    </div>
  );
}
