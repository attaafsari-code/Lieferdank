import { requireAdmin } from "@/server/guards";
import { getDb } from "@/lib/db";
import { formatDateTime, formatEuro } from "@/lib/format";
import { effectiveTip } from "@/lib/money";
import { TipRefund } from "../admin-controls";
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
        <Table head={["Zeitpunkt", "Code", "Kunde zahlte", "Erstattet", "Fahrer vor Stripe-Kosten", "Lieferdank-Gebühr", "Status", "Zahlart", "Aktion"]} minWidth="64rem">
          {tips.map((tip) => {
            const refunded = tip.refundedCents ?? 0;
            // Nach Erstattungen zeigen die Spalten, was tatsächlich bleibt.
            const left = effectiveTip(tip);
            const partial = tip.paymentStatus === "succeeded" && refunded > 0;
            return (
              <tr key={tip.id}>
                <Td>{formatDateTime(tip.createdAt)}</Td>
                <Td mono>{codeById.get(tip.driverId) ?? "—"}</Td>
                <Td>{formatEuro(tip.grossCents)}</Td>
                <Td>{refunded > 0 ? formatEuro(refunded) : "—"}</Td>
                <Td>{formatEuro(left.driverCents)}</Td>
                <Td>{formatEuro(left.platformFeeCents)}</Td>
                <Td>{partial ? "teilweise erstattet" : STATUS[tip.paymentStatus] ?? tip.paymentStatus}{tip.paymentStatus === "review_required" && paymentById.get(tip.paymentId)?.failureReason ? ` · ${paymentById.get(tip.paymentId)?.failureReason}` : ""}</Td>
                <Td>{paymentById.get(tip.paymentId)?.method ?? "—"}</Td>
                <Td>
                  {tip.paymentStatus === "succeeded" && refunded < tip.grossCents ? (
                    <TipRefund tip={{
                      id: tip.id, grossCents: tip.grossCents, driverCents: tip.driverCents, platformGrossFeeCents: tip.platformGrossFeeCents,
                      refundedCents: refunded, feeRefundedCents: tip.feeRefundedCents ?? 0,
                    }} />
                  ) : "—"}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
      <p className="mt-4 text-xs text-ink-faint">
        Stripe berechnet Zahlungs- und Auszahlungskosten beim Connected Account. Die tatsächlichen Stripe-Abrechnungen sind maßgeblich.
        Erstattungen laufen über Stripe aus dem Guthaben des Zustellers; Lieferdank gibt seine Gebühr vollständig bzw. anteilig zurück –
        auch dann, wenn der Zusteller selbst in Stripe erstattet. Rückbuchungen werden nicht automatisch verrechnet.
      </p>
    </div>
  );
}
