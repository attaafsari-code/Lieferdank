import { getDb } from "@/lib/db";
import { driverPublicName } from "@/server/services/drivers";
import { formatDateTime, formatEuro } from "@/lib/format";
import { AdminTitle, Badge, Empty, SectionHeading, Table, Td } from "../ui";
import { PayoutButton } from "../admin-controls";

export const dynamic = "force-dynamic";

export default async function AdminPayouts() {
  const db = getDb();
  const [open, drivers, users, payouts] = await Promise.all([
    db.tips.findMany({ where: { paymentStatus: "succeeded", payoutStatus: "in_balance" } }),
    db.driverProfiles.findMany(),
    db.users.findMany({ where: { role: "driver" } }),
    db.payouts.findMany({ orderBy: "createdAt", desc: true, limit: 50 }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));

  const balances = drivers
    .map((driver) => {
      const tips = open.filter((tip) => tip.driverId === driver.id);
      return {
        driver,
        user: userById.get(driver.userId),
        balance: tips.reduce((sum, tip) => sum + tip.driverCents, 0),
        heldByPlatform: tips.filter((tip) => !tip.destinationAccountId).reduce((sum, tip) => sum + tip.driverCents, 0),
      };
    })
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  return (
    <div className="space-y-12">
      <AdminTitle
        title="Auszahlungen"
        lead="Anteile, die schon direkt beim Lieferanten gelandet sind, werden nur gebucht. Nur was die Plattform hält, wird überwiesen."
      />

      <section>
        <SectionHeading>Offene Guthaben</SectionHeading>
        {balances.length === 0 ? (
          <Empty>Kein offenes Guthaben.</Empty>
        ) : (
          <ul className="space-y-3">
            {balances.map(({ driver, user, balance, heldByPlatform }) => (
              <li key={driver.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5 shadow-xs">
                <span>
                  <span className="block font-bold text-ink">
                    {user ? driverPublicName(driver, user) : driver.code}{" "}
                    <span className="font-mono text-xs text-ink-faint">{driver.code}</span>
                  </span>
                  <span className="block text-sm text-ink-soft">
                    Guthaben {formatEuro(balance)} · davon zu überweisen {formatEuro(heldByPlatform)} ·{" "}
                    {driver.payoutReady ? "Konto bereit" : "kein Auszahlungskonto"}
                  </span>
                </span>
                <PayoutButton driverId={driver.id} label={formatEuro(balance)} />
              </li>
            ))}
          </ul>
        )}
      </section>

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
