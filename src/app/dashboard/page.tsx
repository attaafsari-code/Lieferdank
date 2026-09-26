import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDriverStats } from "@/lib/stats";
import { getStore } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { providerLabel } from "@/lib/providers";
import { ArrowRight, Check, Euro, Heart } from "@/components/icons";
import {
  EmptyState,
  MilestoneList,
  SectionTitle,
  StatTile,
  ThankYouList,
} from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (!session?.driver) redirect("/login");

  const query = await searchParams;
  const driver = session.driver;
  const [stats, verification] = await Promise.all([
    getDriverStats(driver.id),
    getStore().getVerificationByUserId(session.user.id),
  ]);

  const welcome = query.willkommen === "1";

  const steps = [
    { done: true, label: "Profil erstellt", href: "/dashboard/profil" },
    { done: true, label: "Danke-Code erhalten", href: "/dashboard/code" },
    {
      done: Boolean(driver.providerId),
      label: "Zustelldienst angeben",
      optional: true,
      href: "/dashboard/profil",
    },
    {
      done: driver.payoutReady,
      label: "Auszahlungskonto einrichten",
      href: "/dashboard/einnahmen",
    },
  ];
  const openSteps = steps.filter((step) => !step.done);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight text-brand-900">
          {welcome ? `Willkommen bei Lieferdank, ${driver.displayName}!` : `Schön, dass du da bist, ${driver.displayName}`}{" "}
          <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-ink-soft">
          Dein Code{" "}
          <span className="font-mono font-bold text-ink">{driver.code}</span>
          {driver.providerId && ` · unterwegs für ${providerLabel(driver.providerId)}`}
        </p>
      </header>

      {welcome && (
        <section className="rounded-2xl border border-brand-100 bg-brand-50 p-6">
          <p className="font-bold text-brand-900">Dein Danke-Code ist fertig.</p>
          <p className="mt-1.5 leading-relaxed text-brand-900/80">
            Zeig ihn deinen Kunden – als Karte, am Handy oder am Schlüsselband. Danke sagen
            ist für Kunden kostenlos.
          </p>
          <Link href="/dashboard/code" className="btn btn-primary btn-sm mt-5">
            Meinen QR-Code ansehen
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      {driver.verification === "rejected" && verification?.reviewNote && (
        <section className="rounded-2xl border border-coral-100 bg-coral-50 p-6">
          <p className="font-bold text-coral-600">Abzeichen nicht bestätigt</p>
          <p className="mt-1.5 leading-relaxed text-ink">{verification.reviewNote}</p>
          <p className="mt-2 text-sm text-ink-soft">
            Dein Danke-Code funktioniert weiterhin ganz normal.
          </p>
          <Link href="/dashboard/profil#abzeichen" className="btn btn-ghost btn-sm mt-5">
            Erneut einreichen
          </Link>
        </section>
      )}

      <section>
        <SectionTitle>Heute</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            tone="coral"
            icon={<Heart className="h-5 w-5" />}
            value={String(stats.today.thanks)}
            label="Danke"
          />
          <StatTile
            icon={<Euro className="h-5 w-5" />}
            value={formatEuro(stats.today.driverCents)}
            label="verdient"
          />
        </div>
      </section>

      <section>
        <SectionTitle>Diese Woche</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            tone="coral"
            icon={<Heart className="h-5 w-5" />}
            value={String(stats.week.thanks)}
            label="Danke"
          />
          <StatTile
            icon={<Euro className="h-5 w-5" />}
            value={formatEuro(stats.week.driverCents)}
            label="verdient"
          />
        </div>
        {stats.streakDays >= 2 && (
          <p className="mt-3 rounded-2xl bg-brand-50 px-4 py-3.5 text-sm font-semibold text-brand-900">
            🔥 {stats.streakDays} Tage hintereinander ein Danke erhalten.
          </p>
        )}
      </section>

      {openSteps.length > 0 && (
        <section>
          <SectionTitle>Nächste Schritte</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {steps.map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className="flex items-center gap-3.5 px-5 py-4 transition hover:bg-canvas"
                >
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                      step.done
                        ? "bg-brand-50 text-brand"
                        : "border-[1.5px] border-line bg-white"
                    }`}
                  >
                    {step.done && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="sr-only">{step.done ? "Erledigt: " : "Offen: "}</span>
                  <span
                    className={`flex-1 font-semibold ${
                      step.done ? "text-ink-faint line-through" : "text-ink"
                    }`}
                  >
                    {step.label}
                    {step.optional && !step.done && (
                      <span className="ml-2 font-medium text-ink-faint">optional</span>
                    )}
                  </span>
                  {!step.done && <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle action={{ href: "/dashboard/danke", label: "Alle ansehen" }}>
          Letzte Nachrichten
        </SectionTitle>
        <ThankYouList items={stats.recentThankYous.slice(0, 5)} />
      </section>

      <section>
        <SectionTitle>Meilensteine</SectionTitle>
        {stats.milestones.length === 0 ? (
          <EmptyState>
            Dein erster Meilenstein wartet: Sobald dir jemand das erste Mal Danke sagt,
            findest du ihn hier.
          </EmptyState>
        ) : (
          <MilestoneList items={stats.milestones.slice(0, 4)} />
        )}
      </section>
    </div>
  );
}
