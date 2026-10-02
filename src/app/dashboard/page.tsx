import Link from "next/link";
import { requireDriver } from "@/server/guards";
import { getDriverStats } from "@/server/services/stats";
import { cardContext } from "@/server/services/cards";
import { isDemoPayment } from "@/server/payments";
import { formatDateTime, formatEuro } from "@/lib/format";
import { dativeName } from "@/lib/names";
import { ArrowRight, Check, Euro, Heart } from "@/components/icons";
import { CardPreview } from "@/components/card-preview";
import { EmptyState, MilestoneList, SectionTitle, StatTile, ThankYouList } from "@/components/dashboard-ui";
import { nextThankYouMilestone } from "@/lib/milestone-rules";
import { PayoutSetup } from "./einnahmen/payout-setup";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { user, driver } = await requireDriver();
  const query = await searchParams;
  const [stats, card] = await Promise.all([getDriverStats(driver.id), cardContext(driver, user)]);
  const welcome = query.willkommen === "1";

  const steps = [
    { done: true, label: "Danke-Code erhalten", href: "/dashboard/karte" },
    {
      done: Boolean(driver.tagline || driver.photoKey || driver.nameDisplay !== "first"),
      label: "Profil personalisieren",
      href: "/dashboard/profil",
    },
    { done: card.design.updatedAt !== driver.createdAt, label: "Karte gestalten", href: "/dashboard/karte" },
    { done: driver.payoutReady, label: "Auszahlungskonto einrichten", href: "/dashboard/einnahmen" },
  ];
  const openSteps = steps.filter((step) => !step.done).length;
  const nextMilestone = nextThankYouMilestone(stats.total.thanks);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight text-brand-900">
          {welcome ? `Willkommen, ${user.firstName}!` : `Hallo ${user.firstName}`} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-ink-soft">
          Kunden sehen dich als <span className="font-semibold text-ink">„{card.publicName}“</span> ·{" "}
          <span className="font-mono">{driver.code}</span>
        </p>
      </header>

      {!driver.payoutReady && (
        <aside role="status" className="rounded-2xl border border-coral-100 bg-coral-50 px-5 py-4 sm:px-6 sm:py-5">
          <p className="font-extrabold text-coral-600">Auszahlung noch nicht eingerichtet</p>
          <p className="mt-1 text-sm leading-relaxed text-coral-600">
            Richte dein Auszahlungskonto ein, damit du Trinkgelder empfangen kannst. Dein QR-Code und kostenlose Danksagungen funktionieren bereits.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-coral-600">
            Stripe ist unser Zahlungs- und Auszahlungspartner. Du brauchst noch kein Stripe-Konto. Die Einrichtung erfolgt im nächsten Schritt direkt bei Stripe.
          </p>
          <div className="mt-4 max-w-sm">
            <PayoutSetup hasAccount={Boolean(driver.payoutAccountId)} ready={false} buttonLabel="Auszahlung einrichten" hints={!isDemoPayment()} />
          </div>
        </aside>
      )}

      {!driver.active && (
        <p className="rounded-2xl border border-coral-100 bg-coral-50 px-5 py-4 text-sm font-semibold text-coral-600">
          Dein Code ist pausiert – Kunden können dir gerade nicht Danke sagen.{" "}
          <Link href="/dashboard/profil" className="underline">Aktivieren</Link>
        </p>
      )}

      <section>
        <SectionTitle>Heute</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile tone="coral" icon={<Heart className="h-5 w-5" />} value={String(stats.today.thanks)} label="Danke" />
          <StatTile icon={<Euro className="h-5 w-5" />} value={formatEuro(stats.today.driverCents)} label="Trinkgeld" />
          <StatTile icon={<Check className="h-5 w-5" />} value={formatEuro(stats.total.driverCents)} label="Insgesamt vor Stripe-Kosten" />
        </div>
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <div>
          <SectionTitle>Diese Woche</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat value={String(stats.week.thanks)} label="Danke" />
            <MiniStat value={formatEuro(stats.week.driverCents)} label="Einnahmen" />
          </div>
        </div>
        <div>
          <SectionTitle>Diesen Monat</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat value={String(stats.month.thanks)} label="Danke" />
            <MiniStat value={formatEuro(stats.month.driverCents)} label="Einnahmen" />
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Seit Beginn</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile tone="coral" icon={<Heart className="h-5 w-5" />} value={String(stats.freeThankYouTotal)} label="Danke gesamt" />
          <StatTile icon={<Euro className="h-5 w-5" />} value={formatEuro(stats.total.driverCents)} label="Einnahmen gesamt" />
        </div>
        <p className="mt-2 text-xs text-ink-faint">Einnahmen aus bestätigten Trinkgeldern, vor Stripe-Kosten.</p>
      </section>

      {stats.streakDays >= 2 && (
        <p className="-mt-6 rounded-2xl bg-brand-50 px-4 py-3.5 text-sm font-semibold text-brand-900">
          🔥 {stats.streakDays} Tage hintereinander ein Danke erhalten.
        </p>
      )}

      <section className="grid items-start gap-6 rounded-3xl border border-line bg-white p-5 shadow-xs sm:grid-cols-[1.1fr_1fr] sm:p-6">
        <CardPreview
          className="overflow-hidden rounded-xl shadow-md"
          layout={card.design.layout}
          headline={card.design.headline}
          publicName={card.publicName}
          providerLabel={null}
          code={card.code}
          qrSvg={card.qr}
          avatar={
            card.design.showPhoto || card.design.layout === "personal"
              ? { href: card.design.showPhoto ? card.photoUrl : null, initials: card.initials }
              : null
          }
          idPrefix="dash"
        />
        <div>
          <h2 className="text-lg font-extrabold text-brand-900">Deine Lieferdank-Karte</h2>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">
            Zeig den QR-Code am Handy, trag die Karte sichtbar oder bestell eine echte Plastikkarte.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <Link href="/dashboard/karte" className="btn btn-primary btn-sm">
              Karte gestalten & herunterladen
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard/karte/bestellen" className="btn btn-ghost btn-sm">
              Plastikkarte bestellen
            </Link>
          </div>
        </div>
      </section>

      {openSteps > 0 && (
        <section>
          <SectionTitle>Nächste Schritte</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {steps.map((step) => (
              <li key={step.label}>
                <Link href={step.href} className="flex items-center gap-3.5 px-5 py-4 transition hover:bg-canvas">
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                      step.done ? "bg-brand-50 text-brand" : "border-[1.5px] border-line bg-white"
                    }`}
                  >
                    {step.done && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="sr-only">{step.done ? "Erledigt: " : "Offen: "}</span>
                  <span className={`flex-1 font-semibold ${step.done ? "text-ink-faint line-through" : "text-ink"}`}>
                    {step.label}
                  </span>
                  {!step.done && <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle action={{ href: "/dashboard/danke", label: "Alle ansehen" }}>Letzte Nachrichten</SectionTitle>
        <ThankYouList items={stats.recentThankYous.slice(0, 4)} />
      </section>

      <section>
        <SectionTitle action={{ href: "/dashboard/einnahmen", label: "Alle ansehen" }}>Letzte Zahlungen</SectionTitle>
        {stats.recentTips.length === 0 ? (
          <EmptyState>
            Noch kein Trinkgeld. Danke sagen ist für Kunden kostenlos – Trinkgeld kommt oft später dazu.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {stats.recentTips.slice(0, 4).map((tip) => (
              <li key={tip.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <span className="text-sm text-ink-soft">{formatDateTime(tip.createdAt)}</span>
                <span className="font-bold text-ink">+ {formatEuro(tip.driverCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle action={{ href: "/dashboard/danke", label: "Alle" }}>Meilensteine</SectionTitle>
        <MilestoneList items={stats.milestones.slice(0, 4)} />
        {nextMilestone !== null && (
          <div className="mt-4 rounded-2xl border border-line bg-white px-5 py-4 shadow-xs">
            <p className="font-bold text-brand-900">Nächster Meilenstein: {nextMilestone} Danke</p>
            <p className="mt-1 text-sm text-ink-soft">{stats.total.thanks} von {nextMilestone} erreicht</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-50" role="progressbar" aria-label={`Fortschritt bis ${nextMilestone} Danke`} aria-valuenow={stats.total.thanks} aria-valuemin={0} aria-valuemax={nextMilestone}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (stats.total.thanks / nextMilestone) * 100)}%` }} />
            </div>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-ink-faint">
        Tipp: Kunden sehen „Sag {dativeName(card.publicName)} Danke“ – ändern kannst du das im Profil.
      </p>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-xs">
      <p className="text-xl font-extrabold tracking-tight text-brand-900">{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  );
}
