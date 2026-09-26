import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDriverStats } from "@/lib/stats";
import { formatDateTime, formatEuro } from "@/lib/format";
import { PLATFORM_GROSS_FEE_CENTS } from "@/lib/money";
import { nextPayoutDateLabel } from "@/lib/time";
import { isDemoPayment } from "@/lib/payments";
import { EmptyState, PageTitle, SectionTitle } from "@/components/dashboard-ui";
import { Check } from "@/components/icons";
import { PayoutSetup } from "./payout-setup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Einnahmen" };

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (!session?.driver) redirect("/login");

  const query = await searchParams;
  const driver = session.driver;
  const stats = await getDriverStats(driver.id);

  return (
    <div className="space-y-12">
      <PageTitle
        title="Einnahmen"
        lead="Dein Trinkgeld sammelt sich als Guthaben und wird gebündelt ausgezahlt."
      />

      <section className="relative overflow-hidden rounded-3xl bg-brand-900 p-7 text-white shadow-md">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-10 h-52 w-52 rounded-full bg-brand/40 blur-3xl" />
        </div>
        <div className="relative">
          <p className="text-sm font-semibold text-white/60">Lieferdank-Guthaben</p>
          <p className="mt-1.5 text-[2.75rem] leading-none font-extrabold tracking-tight">
            {formatEuro(stats.balanceCents)}
          </p>
          <p className="mt-4 text-[0.9375rem] text-white/75">
            {driver.payoutReady
              ? `Nächste Auszahlung: ${nextPayoutDateLabel()}`
              : "Richte dein Auszahlungskonto ein, damit wir überweisen können."}
          </p>
          {stats.paidOutCents > 0 && (
            <p className="mt-1 text-sm text-white/55">
              Bereits ausgezahlt: {formatEuro(stats.paidOutCents)}
            </p>
          )}
        </div>
      </section>

      {query.konto === "fertig" && (
        <p className="rounded-2xl bg-brand-50 px-4 py-3.5 text-sm font-semibold text-brand-900">
          Danke! Wir prüfen dein Auszahlungskonto. Den Status kannst du unten aktualisieren.
        </p>
      )}

      <section>
        <SectionTitle>Auszahlungskonto</SectionTitle>
        <div className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-xs">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                driver.payoutReady
                  ? "bg-brand-50 text-brand"
                  : "border-[1.5px] border-line bg-white"
              }`}
            >
              {driver.payoutReady && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="sr-only">{driver.payoutReady ? "Erledigt: " : "Offen: "}</span>
            <span className="flex-1">
              <span className="block font-semibold text-ink">
                Auszahlungskonto eingerichtet
              </span>
              <span className="mt-1 block text-[0.9375rem] leading-relaxed text-ink-soft">
                Die Einrichtung läuft über unseren Zahlungsdienstleister. Er prüft dabei
                deine Identität – gesetzlich vorgeschrieben für jede Auszahlung. Lieferdank
                sieht deine Bankdaten nicht.
              </span>
            </span>
          </div>

          <PayoutSetup hasAccount={Boolean(driver.payoutAccountId)} ready={driver.payoutReady} />

          {isDemoPayment() && (
            <p className="rounded-xl bg-canvas px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-soft">
              Testmodus: Die Einrichtung wird simuliert. Es werden keine Bankdaten erhoben und
              kein Geld bewegt.
            </p>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Deine Trinkgelder</SectionTitle>
        {stats.recentTips.length === 0 ? (
          <EmptyState>
            Noch kein Trinkgeld erhalten. Danke sagen ist für Kunden kostenlos – Trinkgeld
            kommt oft erst später dazu.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {stats.recentTips.map((tip) => (
              <li key={tip.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <span className="min-w-0">
                  <span className="block font-bold text-ink">
                    {formatEuro(tip.driverCents)}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {formatDateTime(tip.createdAt)} · Kunde zahlte {formatEuro(tip.grossCents)}
                  </span>
                </span>
                <span
                  className={`chip shrink-0 ${
                    tip.payoutStatus === "paid_out"
                      ? "bg-brand-50 text-brand"
                      : "bg-canvas text-ink-soft"
                  }`}
                >
                  {tip.payoutStatus === "paid_out" ? "ausgezahlt" : "im Guthaben"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm leading-relaxed text-ink-soft">
        „Im Guthaben“ heißt: Der Betrag gehört dir und ist für die nächste Auszahlung
        vorgemerkt. Pro Trinkgeldzahlung werden {formatEuro(PLATFORM_GROSS_FEE_CENTS)} für
        Zahlungsabwicklung und Lieferdank einbehalten. Der Rest gehört dir. Mehr dazu in den{" "}
        <Link href="/legal/agb" className="font-semibold text-brand underline underline-offset-2">
          AGB
        </Link>
        .
      </p>
    </div>
  );
}
