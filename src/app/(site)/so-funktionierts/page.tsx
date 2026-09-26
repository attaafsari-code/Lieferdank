import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-shell";
import { ArrowRight } from "@/components/icons";
import { formatEuro } from "@/lib/format";
import { PLATFORM_GROSS_FEE_CENTS, TIP_OPTIONS_CENTS } from "@/lib/money";

export const metadata: Metadata = {
  title: "So funktioniert's",
  description: "Vom QR-Code bis zum Danke: der komplette Ablauf bei Lieferdank.",
  alternates: { canonical: "/so-funktionierts" },
};

const DRIVER_STEPS = [
  {
    title: "Registrieren",
    text: "Du erstellst kostenlos dein Profil. Wir fragen nur, was wir wirklich brauchen.",
  },
  {
    title: "Danke-Code erhalten",
    text: "Sofort nach der Registrierung: dein persönlicher QR-Code, digital und als druckbare Karte.",
  },
  {
    title: "Sichtbar tragen",
    text: "Am Schlüsselband, an der Scannertasche oder auf der Paketablage. Du musst niemanden ansprechen.",
  },
  {
    title: "Auszahlungskonto einrichten",
    text: "Einmalig beim Zahlungsdienstleister. Der prüft deine Identität – wie bei jedem Konto gesetzlich vorgeschrieben.",
  },
  {
    title: "Danke bekommen",
    text: "Im Dashboard siehst du, wie viele Menschen Danke gesagt haben – und was an Trinkgeld zusammengekommen ist.",
  },
];

const CUSTOMER_STEPS = [
  {
    title: "QR-Code scannen",
    text: "Mit der normalen Kamera. Keine App, kein Konto, keine Registrierung.",
  },
  {
    title: "Danke sagen",
    text: "Ein Tipp auf „Kostenlos Danke sagen“ genügt. Das ist immer gratis.",
  },
  {
    title: "Optional Trinkgeld",
    text: "2 €, 3 €, 5 € oder ein eigener Betrag. Freiwillig, nie eine Bedingung.",
  },
  {
    title: "Kurze Nachricht",
    text: "Danach kannst du noch etwas Nettes schreiben. Auch das ist optional.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Ablauf"
        title="So funktioniert Lieferdank"
        lead="Ein Code, ein Scan, ein Danke. Mehr braucht es nicht."
      />

      <div className="container-page max-w-3xl pb-24">
        <Section title="Für Zusteller" steps={DRIVER_STEPS} />
        <Section title="Für Kunden" steps={CUSTOMER_STEPS} />

        <section className="mt-16">
          <h2 className="mb-5 text-xl font-extrabold text-brand-900">
            Was mit dem Geld passiert
          </h2>
          <p className="leading-relaxed text-ink-soft">
            Du zahlst exakt den Betrag, den du auswählst. Es kommt nichts obendrauf. Pro
            Trinkgeldzahlung behalten wir {formatEuro(PLATFORM_GROSS_FEE_CENTS)} ein. Davon
            bezahlen wir die Zahlungsabwicklung, den Betrieb der Plattform, den Support und
            die Betrugsprävention. Der Rest geht an den Zusteller.
          </p>

          <div className="card-lift mt-7 !p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-3.5 text-xs font-bold tracking-wide text-ink-faint uppercase">
                    Kunde zahlt
                  </th>
                  <th className="px-5 py-3.5 text-xs font-bold tracking-wide text-ink-faint uppercase">
                    Zusteller erhält
                  </th>
                  <th className="px-5 py-3.5 text-xs font-bold tracking-wide text-ink-faint uppercase">
                    Abwicklung
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {TIP_OPTIONS_CENTS.map((cents) => (
                  <tr key={cents}>
                    <td className="px-5 py-3.5 font-extrabold text-ink">
                      {formatEuro(cents)}
                    </td>
                    <td className="px-5 py-3.5 font-extrabold text-coral">
                      {formatEuro(cents - PLATFORM_GROSS_FEE_CENTS)}
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft">
                      {formatEuro(PLATFORM_GROSS_FEE_CENTS)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink-soft">
            Der einbehaltene Anteil ist immer gleich hoch, egal wie viel du gibst. Wer mehr
            gibt, bei dem kommt anteilig also mehr an.
          </p>
        </section>

        <div className="mt-16 text-center">
          <Link href="/register" className="btn btn-primary btn-lg">
            Kostenlos Danke-Code erstellen
            <ArrowRight className="h-[1.05rem] w-[1.05rem]" />
          </Link>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  steps,
}: {
  title: string;
  steps: { title: string; text: string }[];
}) {
  return (
    <section className="mt-16 first:mt-0">
      <h2 className="mb-6 text-xl font-extrabold text-brand-900">{title}</h2>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-2xl border border-line bg-white p-5 shadow-xs"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 font-extrabold text-brand">
              {index + 1}
            </span>
            <span>
              <span className="block font-bold text-ink">{step.title}</span>
              <span className="mt-1 block leading-relaxed text-ink-soft">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
