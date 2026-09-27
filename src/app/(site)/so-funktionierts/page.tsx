import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-shell";
import { ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "So funktioniert's",
  description: "Vom QR-Code bis zum Danke: der komplette Ablauf bei Lieferdank.",
  alternates: { canonical: "/so-funktionierts" },
};

const DRIVER_STEPS = [
  {
    title: "Registrieren",
    text: "Du erstellst kostenlos dein Profil und bekommst sofort deinen dauerhaften Lieferdank-Code.",
  },
  {
    title: "Profil personalisieren",
    text: "Welcher Name öffentlich erscheint, ob mit Foto, ob mit Lieferdienst – das entscheidest du.",
  },
  {
    title: "Karte gestalten",
    text: "Eigener Text, drei Designs. Herunterladen, ausdrucken oder als Plastikkarte bestellen.",
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
    text: "2 €, 3 €, 5 € oder ein eigener Betrag – mit Apple Pay, Google Pay, PayPal oder Karte. Freiwillig.",
  },
  {
    title: "Kurze Nachricht",
    text: "Danach kannst du noch etwas Nettes schreiben. Auch das ist optional.",
  },
  {
    title: "Lieferant speichern",
    text: "Wer mag, speichert seine Lieblingslieferanten in einem kostenlosen Konto. Nötig ist das nie.",
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
        <Section title="Für Lieferanten" steps={DRIVER_STEPS} />
        <Section title="Für Kunden" steps={CUSTOMER_STEPS} />

        <section id="geld" className="mt-16 scroll-mt-24">
          <h2 className="mb-5 text-xl font-extrabold text-brand-900">Was mit dem Geld passiert</h2>
          <p className="leading-relaxed text-ink-soft">
            Du zahlst exakt den Betrag, den du auswählst. Es kommt nichts obendrauf. Vom gewählten
            Betrag werden Zahlungs- und Plattformkosten abgezogen – für Zahlungsabwicklung, Betrieb,
            Support und Betrugsprävention. Der Rest geht an den Zusteller.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Lieferanten sehen die genaue Aufteilung in ihrem Dashboard und in den{" "}
            <Link href="/legal/agb" className="font-semibold text-brand underline underline-offset-2">
              AGB
            </Link>
            .
          </p>
        </section>

        <div className="mt-16 text-center">
          <Link href="/register" className="btn btn-primary btn-lg">
            Als Lieferant starten
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
