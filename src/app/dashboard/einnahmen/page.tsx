import Link from "next/link";
import { requireDriver } from "@/server/guards";
import { getDb } from "@/lib/db";
import { getDriverStats } from "@/server/services/stats";
import { payoutReadinessAfterReturn, payoutsAreManual } from "@/server/services/payouts";
import { isDemoPayment } from "@/server/payments";
import { formatDateTime, formatEuro } from "@/lib/format";
import { effectiveTip } from "@/lib/money";
import { EmptyState, PageTitle, SectionTitle } from "@/components/dashboard-ui";
import { Check } from "@/components/icons";
import { PayoutSetup } from "./payout-setup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Einnahmen" };

/** Standard-Konten verwalten Bankverbindung und Angaben selbst im Stripe-Dashboard. */
const STRIPE_DASHBOARD_LOGIN = "https://dashboard.stripe.com/login";

/** Erfolg nur, wenn Stripe den Stand gerade bestätigt hat – nie aus dem gespeicherten Wert allein. */
const RETURN_NOTICES = {
  ready: "Geschafft! Dein Auszahlungskonto ist bereit – Kunden können dir jetzt Trinkgeld senden.",
  pending:
    "Danke! Stripe prüft deine Angaben noch, das kann einige Minuten dauern. Falls du die Einrichtung unterbrochen hast, tippe auf „Einrichtung fortsetzen“.",
  unverified: "Der aktuelle Stripe-Status konnte gerade nicht geprüft werden. Bitte versuche es später erneut.",
  none: "Du hast noch kein Stripe-Auszahlungskonto eingerichtet. Tippe auf „Auszahlungskonto einrichten“, um zu starten.",
} as const;

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { driver } = await requireDriver();
  const query = await searchParams;
  // Rückkehr aus dem Stripe-Onboarding: Status direkt bei Stripe abfragen, statt auf den
  // Webhook zu warten – auch wenn das Konto vorher schon als bereit gespeichert war.
  const returned = query.konto === "fertig" ? await payoutReadinessAfterReturn(driver) : null;
  const payoutReady = returned ? returned.ready : driver.payoutReady;
  // Steht das Konto bei Stripe auf „manuell“, kommt das Trinkgeld nie von selbst an.
  const manualPayouts = payoutReady && !isDemoPayment() ? await payoutsAreManual(driver) : false;
  const [stats, payouts] = await Promise.all([
    getDriverStats(driver.id),
    getDb().payouts.findMany({ where: { driverId: driver.id }, orderBy: "createdAt", desc: true, limit: 20 }),
  ]);

  return (
    <div className="space-y-12">
      <PageTitle title="Einnahmen" lead="Dein Trinkgeld wird über Stripe deinem Auszahlungskonto zugeordnet. Den Banktermin zeigt Stripe." />

      <section className="relative overflow-hidden rounded-3xl bg-brand-900 p-7 text-white shadow-md">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full bg-brand/40 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-semibold text-white/60">Dein Trinkgeldanteil vor Stripe-Kosten</p>
          <p className="mt-1.5 break-words text-[2.25rem] leading-none font-extrabold tracking-tight sm:text-[2.75rem]">{formatEuro(stats.total.driverCents)}</p>
          <p className="mt-3 text-sm text-white/75">
            Dein tatsächliches Stripe-Guthaben und den Banktermin siehst du bei Stripe. Lieferdank verwahrt dein Geld nicht.
          </p>
          {stats.inReviewCents > 0 && (
            <p className="mt-2 text-sm font-semibold text-white">{formatEuro(stats.inReviewCents)} aus strittigen Zahlungen in Prüfung; nicht im bestätigten Anteil enthalten.</p>
          )}
          <p className="mt-4 text-[0.9375rem] text-white/75">
            {payoutReady
              ? "Dein Auszahlungskonto ist eingerichtet. Den Banktermin findest du bei Stripe."
              : "Schließe die Stripe-Einrichtung ab, bevor Kunden Trinkgeld senden können."}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 text-sm">
            <Figure label="Diese Woche" value={formatEuro(stats.week.driverCents)} />
            <Figure label="Diesen Monat" value={formatEuro(stats.month.driverCents)} />
            <Figure label="Insgesamt" value={formatEuro(stats.total.driverCents)} />
          </div>
        </div>
      </section>

      {returned && (
        <p className="rounded-2xl bg-brand-50 px-4 py-3.5 text-sm font-semibold text-brand-900">{RETURN_NOTICES[returned.notice]}</p>
      )}
      {query.konto === "neu" && driver.payoutAccountId && !payoutReady && (
        <p className="rounded-2xl bg-brand-50 px-4 py-3.5 text-sm font-semibold text-brand-900">
          Der Stripe-Link ist abgelaufen oder wurde schon geöffnet. Tippe auf „Einrichtung fortsetzen“, um dort weiterzumachen.
        </p>
      )}

      <section>
        <SectionTitle>Auszahlungskonto</SectionTitle>
        <div className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-xs">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                payoutReady ? "bg-brand-50 text-brand" : "border-[1.5px] border-line bg-white"
              }`}
            >
              {payoutReady && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-ink">
                {payoutReady ? "Auszahlungskonto eingerichtet" : "Auszahlungskonto einrichten"}
              </span>
              <span className="mt-1 block text-[0.9375rem] leading-relaxed text-ink-soft">
                Läuft über unseren Zahlungsdienstleister. Er prüft dabei deine Identität – das ist
                für Auszahlungen gesetzlich vorgeschrieben. Lieferdank sieht deine Bankdaten nicht.
              </span>
            </span>
          </div>
          {manualPayouts && (
            <p role="status" className="rounded-xl border border-coral-100 bg-coral-50 px-4 py-3 text-sm leading-relaxed font-semibold text-coral-600">
              Deine Auszahlungen stehen bei Stripe auf „Manuell“ – dein Trinkgeld wird so nicht von selbst überwiesen. Melde dich
              bei Stripe an und stelle den Auszahlungsplan auf „Automatisch“.
            </p>
          )}
          <PayoutSetup
            hasAccount={Boolean(driver.payoutAccountId)}
            ready={payoutReady}
            manageUrl={isDemoPayment() ? null : STRIPE_DASHBOARD_LOGIN}
            hints={!isDemoPayment()}
          />
          {isDemoPayment() && (
            <p className="rounded-xl bg-canvas px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-soft">
              Testmodus: Die Einrichtung wird simuliert. Es werden keine Bankdaten erhoben.
            </p>
          )}
          {driver.payoutAccountId && (
            <p className="text-[0.8125rem] text-ink-soft">
              Trinkgeld-Funktion:{" "}
              <Link href="/vertrag-widerrufen" className="font-semibold text-brand underline underline-offset-2">Vertrag widerrufen</Link>
              {" · "}
              <Link href="/vertrag-kuendigen" className="font-semibold text-brand underline underline-offset-2">Verträge hier kündigen</Link>
            </p>
          )}
        </div>
      </section>

      {payouts.length > 0 && (
        <section>
          <SectionTitle>Auszahlungen</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {payouts.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <span>
                  <span className="block font-bold text-ink">{formatEuro(payout.amountCents)}</span>
                  <span className="block text-xs text-ink-faint">
                    {formatDateTime(payout.createdAt)} · {payout.tipIds.length} Trinkgelder
                  </span>
                </span>
                <span className={`chip ${payout.status === "paid" ? "bg-brand-50 text-brand" : payout.status === "failed" ? "bg-coral-50 text-coral-600" : "bg-canvas text-ink-soft"}`}>
                    {payout.status === "paid" ? "an Stripe übertragen" : payout.status === "failed" ? "fehlgeschlagen" : "in Arbeit"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Deine Trinkgelder</SectionTitle>
        {stats.recentTips.length === 0 ? (
          <EmptyState>Noch kein Trinkgeld erhalten. Danke sagen ist für Kunden kostenlos – Trinkgeld kommt oft später dazu.</EmptyState>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {stats.recentTips.map((tip) => (
              <li key={tip.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{formatEuro(effectiveTip(tip).driverCents)} vor Stripe-Kosten</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {formatDateTime(tip.createdAt)} · Kunde zahlte {formatEuro(tip.grossCents)}
                    {(tip.refundedCents ?? 0) > 0 && ` · ${formatEuro(tip.refundedCents)} erstattet`}
                  </span>
                </span>
                <span className={`chip shrink-0 ${tip.paymentStatus === "succeeded" ? "bg-brand-50 text-brand" : "bg-canvas text-ink-soft"}`}>
                  {tip.paymentStatus === "succeeded" ? "bei Stripe" : "in Prüfung"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm leading-relaxed text-ink-soft">
        Bei 2 €, 3 € und 5 € Trinkgeld beträgt die Lieferdank-Gebühr 0,50 €, 0,60 € bzw. 1,00 €.
        Stripe zieht seine eigenen Zahlungs- und gegebenenfalls Auszahlungskosten separat von deinem Stripe-Konto ab.
        Der tatsächliche Auszahlungsbetrag kann daher geringer sein. Mehr in den{" "}
        <Link href="/legal/agb" className="font-semibold text-brand underline underline-offset-2">
          AGB
        </Link>
        .
      </p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-white/55">{label}</p>
      <p className="mt-0.5 break-words font-bold">{value}</p>
    </div>
  );
}
