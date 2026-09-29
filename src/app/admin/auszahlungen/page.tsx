import { requireAdmin } from "@/server/guards";
import { getDb } from "@/lib/db";
import { formatDateTime, formatEuro } from "@/lib/format";
import { AdminTitle, Badge, Empty, SectionHeading, Table, Td } from "../ui";

export const dynamic = "force-dynamic";

export default async function AdminPayouts() {
  await requireAdmin();
  const db = getDb();
  const [drivers, payouts] = await Promise.all([
    db.driverProfiles.findMany(),
    db.payouts.findMany({ orderBy: "createdAt", desc: true, limit: 50 }),
  ]);

  return (
    <div className="space-y-12">
      <AdminTitle
        title="Auszahlungen"
        lead="Stripe führt die Auszahlungen der Connected Accounts durch. Lieferdank startet keine Überweisungen aus dem Plattformkonto."
      />

      <section>
        <SectionHeading>Verlauf</SectionHeading>
        {payouts.length === 0 ? (
          <Empty>Noch keine Auszahlungen.</Empty>
        ) : (
          <Table head={["Zeitpunkt", "Code", "Guthaben", "Überwiesen", "Gebühr", "Status", "Transfer"]}>
            {payouts.map((payout) => (
              <tr key={payout.id}>
                <Td>{formatDateTime(payout.createdAt)}</Td>
                <Td mono>{drivers.find((d) => d.id === payout.driverId)?.code ?? "—"}</Td>
                <Td>{formatEuro(payout.amountCents)}</Td>
                <Td>{formatEuro(payout.transferredCents)}</Td>
                <Td>{formatEuro(payout.feeCents)}</Td>
                <Td>
                  <Badge tone={payout.status === "paid" ? "blue" : payout.status === "failed" ? "coral" : "gray"}>{payout.status}</Badge>
                </Td>
                <Td mono>{payout.providerTransferId ?? payout.failureReason ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
