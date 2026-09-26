import Link from "next/link";
import { getPlatformStats, type PlatformStats } from "@/server/services/stats";
import { getPaymentProvider } from "@/server/payments";
import { formatEuro } from "@/lib/format";
import { dayKey } from "@/lib/time";
import { AdminTitle, Kpi, SectionHeading } from "./ui";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [today, total] = await Promise.all([getPlatformStats("today"), getPlatformStats("all")]);
  const provider = getPaymentProvider();

  return (
    <div className="space-y-12">
      <AdminTitle
        title="Übersicht"
        lead={`Payment-Provider: ${provider.id} (${provider.isSandbox ? "Sandbox" : "Live"}) · Stichtag ${dayKey()}`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/admin/nutzer?status=pending" label="Abzeichen-Anfragen" value={total.pendingBadgeRequests} />
        <QuickLink href="/admin/karten" label="Offene Kartenbestellungen" value={total.openCardOrders} />
        <QuickLink href="/admin/auszahlungen" label="Auszahlungen verwalten" />
      </div>

      <StatsBlock title="Heute" stats={today} />
      <StatsBlock title="Gesamt" stats={total} />

      <p className="text-xs leading-relaxed text-ink-faint">
        Payment- und Auszahlungskosten sind kalkulierte Werte auf Basis der konfigurierten Sätze. Für die
        Buchhaltung zählen die Abrechnungen des Zahlungsdienstleisters.
      </p>
    </div>
  );
}

function QuickLink({ href, label, value }: { href: string; label: string; value?: number }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border border-line bg-white p-5 shadow-xs transition hover:border-brand-200">
      <span className="font-semibold text-ink">{label}</span>
      {value !== undefined && (
        <span className={`chip ${value > 0 ? "bg-coral-50 text-coral-600" : "bg-canvas text-ink-soft"}`}>{value}</span>
      )}
    </Link>
  );
}

function StatsBlock({ title, stats }: { title: string; stats: PlatformStats }) {
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
        <Kpi label="Auszahlungskosten" value={formatEuro(stats.payoutFeeCents)} />
        <Kpi label="Nettomarge" value={formatEuro(stats.netRevenueCents)} highlight />
        <Kpi label="Netto je Transaktion" value={formatEuro(stats.revenuePerTransactionCents)} />
        <Kpi label="Scans" value={String(stats.scanCount)} />
        <Kpi label="Scan → Danke" value={percent(stats.scanToThankYouRate)} />
        <Kpi label="Scan → Zahlung" value={percent(stats.scanToPaymentRate)} />
        <Kpi label="Lieferanten aktiv / gesamt" value={`${stats.activeDrivers} / ${stats.totalDrivers}`} />
        <Kpi label="Kundenkonten" value={String(stats.totalCustomers)} />
      </div>
    </section>
  );
}
