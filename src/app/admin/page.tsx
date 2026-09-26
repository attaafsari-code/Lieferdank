import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { getPlatformStats } from "@/lib/stats";
import { formatDateTime, formatEuro } from "@/lib/format";
import { providerLabel } from "@/lib/providers";
import { getPaymentProvider } from "@/lib/payments";
import { dayKey } from "@/lib/time";
import { DriverControls, VerificationControls } from "./admin-controls";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  const store = getStore();
  const [today, total, drivers, users, tips, verifications, actions] = await Promise.all([
    getPlatformStats("today"),
    getPlatformStats("all"),
    store.listDrivers(),
    store.listUsers(),
    store.listTips(),
    store.listVerifications(),
    store.listAdminActions(),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const verificationByUser = new Map(verifications.map((v) => [v.userId, v]));
  const provider = getPaymentProvider();

  const balanceByDriver = new Map<string, number>();
  for (const tip of tips) {
    if (tip.paymentStatus !== "succeeded" || tip.payoutStatus === "paid_out") continue;
    balanceByDriver.set(tip.driverId, (balanceByDriver.get(tip.driverId) ?? 0) + tip.driverCents);
  }

  const pending = drivers.filter((driver) => driver.verification === "pending");
  const recentTips = [...tips]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25);

  return (
    <div className="space-y-14">
      <header>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight text-brand-900">
          Übersicht
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Payment-Provider: <span className="font-semibold text-ink">{provider.id}</span> (
          {provider.isSandbox ? "Sandbox" : "Live"}) · Stichtag {dayKey()}
        </p>
      </header>

      <StatsBlock title="Heute" stats={today} />
      <StatsBlock title="Gesamt" stats={total} />

      <section>
        <SectionHeading>Offene Abzeichen-Anfragen ({pending.length})</SectionHeading>
        {pending.length === 0 ? (
          <Empty>Keine offenen Anfragen.</Empty>
        ) : (
          <ul className="space-y-3">
            {pending.map((driver) => {
              const user = userById.get(driver.userId);
              const verification = verificationByUser.get(driver.userId);
              return (
                <li
                  key={driver.id}
                  className="rounded-2xl border border-line bg-white p-6 shadow-xs"
                >
                  <p className="font-bold text-ink">
                    {user?.name ?? "Unbekannt"}{" "}
                    <span className="font-mono text-sm font-semibold text-ink-faint">
                      {driver.code}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {user?.email}
                    {user?.phone && ` · ${user.phone}`}
                    {driver.providerId && ` · gibt an: ${providerLabel(driver.providerId)}`}
                    {driver.city && ` · ${driver.city}`}
                  </p>
                  {verification?.documentNote && (
                    <p className="mt-3 rounded-xl bg-canvas px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">
                      {verification.documentNote}
                    </p>
                  )}
                  <VerificationControls driverId={driver.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionHeading>Zusteller ({drivers.length})</SectionHeading>
        <ul className="space-y-3">
          {drivers.map((driver) => {
            const user = userById.get(driver.userId);
            const balance = balanceByDriver.get(driver.id) ?? 0;
            return (
              <li
                key={driver.id}
                className="rounded-2xl border border-line bg-white p-6 shadow-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{driver.displayName}</span>
                  <span className="chip bg-canvas font-mono text-ink-soft">{driver.code}</span>
                  <Badge status={driver.verification} />
                  {!driver.active && <Badge status="paused" />}
                  {user?.blockedAt && <Badge status="blocked" />}
                  {driver.payoutReady && <Badge status="payout" />}
                </div>

                <p className="mt-1.5 text-sm text-ink-soft">
                  {user?.name} · {user?.email}
                  {driver.providerId &&
                    ` · ${providerLabel(driver.providerId)}${driver.providerVerified ? " (geprüft)" : " (eigene Angabe)"}`}
                  {" · Guthaben "}
                  <span className="font-semibold text-ink">{formatEuro(balance)}</span>
                </p>

                {user?.blockedReason && (
                  <p className="mt-1.5 text-sm font-medium text-coral-600">
                    Sperrgrund: {user.blockedReason}
                  </p>
                )}

                <DriverControls
                  driverId={driver.id}
                  userId={driver.userId}
                  blocked={Boolean(user?.blockedAt)}
                  providerVerified={driver.providerVerified}
                  hasProvider={Boolean(driver.providerId)}
                  balanceCents={balance}
                  balanceLabel={formatEuro(balance)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionHeading>Letzte Transaktionen</SectionHeading>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-xs">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b border-line text-left text-xs font-bold tracking-wide text-ink-faint uppercase">
              <tr>
                <Th>Zeitpunkt</Th>
                <Th>Zusteller</Th>
                <Th>Brutto</Th>
                <Th>Zusteller</Th>
                <Th>Plattform brutto</Th>
                <Th>Paymentkosten</Th>
                <Th>Netto</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recentTips.map((tip) => {
                const driver = drivers.find((d) => d.id === tip.driverId);
                return (
                  <tr key={tip.id}>
                    <Td>{formatDateTime(tip.createdAt)}</Td>
                    <Td mono>{driver?.code ?? "—"}</Td>
                    <Td>{formatEuro(tip.grossCents)}</Td>
                    <Td>{formatEuro(tip.driverCents)}</Td>
                    <Td>{formatEuro(tip.platformGrossFeeCents)}</Td>
                    <Td>{formatEuro(tip.paymentProviderFeeCents)}</Td>
                    <Td strong>{formatEuro(tip.platformNetRevenueCents)}</Td>
                    <Td>{tip.paymentStatus}</Td>
                  </tr>
                );
              })}
              {recentTips.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-ink-soft">
                    Noch keine Transaktionen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Paymentkosten sind kalkulierte Werte auf Basis der konfigurierten Providersätze.
          Für die Buchhaltung zählen die tatsächlichen Abrechnungen des
          Zahlungsdienstleisters.
        </p>
      </section>

      <section>
        <SectionHeading>Adminprotokoll</SectionHeading>
        {actions.length === 0 ? (
          <Empty>Noch keine Aktionen.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {actions.slice(0, 25).map((action) => (
              <li key={action.id} className="px-5 py-3.5 text-sm">
                <span className="font-semibold text-ink">{action.action}</span>{" "}
                <span className="text-ink-soft">
                  · {action.actorEmail} · {formatDateTime(action.createdAt)}
                  {action.reason && ` · ${action.reason}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatsBlock({
  title,
  stats,
}: {
  title: string;
  stats: Awaited<ReturnType<typeof getPlatformStats>>;
}) {
  const percent = (value: number) => `${(value * 100).toFixed(1)} %`;

  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Trinkgeldvolumen" value={formatEuro(stats.grossTipVolumeCents)} />
        <Kpi label="Transaktionen" value={String(stats.tipCount)} />
        <Kpi label="Ø Trinkgeld" value={formatEuro(stats.averageTipCents)} />
        <Kpi label="Kostenlose Danke" value={String(stats.freeThankYouCount)} />
        <Kpi label="Plattformgebühr brutto" value={formatEuro(stats.grossPlatformFeeCents)} />
        <Kpi label="Paymentkosten" value={formatEuro(stats.paymentFeeCents)} />
        <Kpi label="Net Revenue" value={formatEuro(stats.netRevenueCents)} highlight />
        <Kpi label="Netto je Transaktion" value={formatEuro(stats.revenuePerTransactionCents)} />
        <Kpi label="Scans" value={String(stats.scanCount)} />
        <Kpi label="Scan → Danke" value={percent(stats.scanToThankYouRate)} />
        <Kpi label="Scan → Zahlung" value={percent(stats.scanToPaymentRate)} />
        <Kpi
          label="Zusteller aktiv / gesamt"
          value={`${stats.activeDrivers} / ${stats.totalDrivers}`}
        />
      </div>
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-extrabold text-brand-900">{children}</h2>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-7 text-center text-ink-soft">
      {children}
    </p>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-xs ${
        highlight ? "border-brand-200 bg-brand-50" : "border-line bg-white"
      }`}
    >
      <p className="text-[0.6875rem] font-bold tracking-wide text-ink-faint uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-extrabold tracking-tight text-brand-900">{value}</p>
    </div>
  );
}

const BADGES: Record<string, { text: string; tone: string }> = {
  verified: { text: "Abzeichen bestätigt", tone: "bg-brand-50 text-brand" },
  pending: { text: "Abzeichen in Prüfung", tone: "bg-canvas text-ink-soft" },
  unverified: { text: "ohne Abzeichen", tone: "bg-canvas text-ink-faint" },
  rejected: { text: "Abzeichen abgelehnt", tone: "bg-coral-50 text-coral-600" },
  paused: { text: "pausiert", tone: "bg-canvas text-ink-soft" },
  blocked: { text: "gesperrt", tone: "bg-coral-50 text-coral-600" },
  payout: { text: "Auszahlung bereit", tone: "bg-brand-50 text-brand" },
};

function Badge({ status }: { status: string }) {
  const badge = BADGES[status];
  if (!badge) return null;
  return <span className={`chip ${badge.tone}`}>{badge.text}</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3.5 font-bold">{children}</th>;
}

function Td({
  children,
  strong,
  mono,
}: {
  children: React.ReactNode;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={`px-5 py-3.5 whitespace-nowrap ${mono ? "font-mono text-xs" : ""} ${
        strong ? "font-bold text-brand-900" : "text-ink"
      }`}
    >
      {children}
    </td>
  );
}
