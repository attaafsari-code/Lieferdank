import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-shell";
import { ArrowRight } from "@/components/icons";
import { formatEuro } from "@/lib/format";
import { PLATFORM_GROSS_FEE_CENTS } from "@/lib/money";

export const metadata: Metadata = {
  title: "Für Zusteller",
  description:
    "Dein Einsatz verdient ein Danke. Hol dir deinen persönlichen Lieferdank-Code – kostenlos, ohne Verifizierungshürde.",
  alternates: { canonical: "/fahrer" },
};

const BENEFITS = [
  {
    title: "Kostenlos für dich",
    text: `Registrierung, Danke-Code und Dashboard kosten dich nichts. Wir verdienen nur, wenn ein Kunde freiwillig Trinkgeld gibt – ${formatEuro(PLATFORM_GROSS_FEE_CENTS)} pro Zahlung.`,
  },
  {
    title: "Sofort einsatzbereit",
    text: "Nach der Registrierung hast du deinen QR-Code. Kein Arbeitgebernachweis, keine Wartezeit, keine Freischaltung.",
  },
  {
    title: "Der Code gehört dir",
    text: "Deine Lieferdank-ID bleibt bei dir, auch wenn du den Arbeitgeber wechselst. Kein Paketdienst kann sie dir wegnehmen.",
  },
  {
    title: "Nur Positives",
    text: "Kunden können dir kein schlechtes Feedback geben. Keine Sterne, keine Beschwerden, keine Ranglisten.",
  },
  {
    title: "Keine Überwachung",
    text: "Wir liefern keine Leistungsdaten an Arbeitgeber. Was du verdienst, sehen nur du und – soweit gesetzlich nötig – die Buchhaltung.",
  },
  {
    title: "Auszahlung gebündelt",
    text: "Dein Trinkgeld sammelt sich als Guthaben und wird gesammelt ausgezahlt. So gehen nicht bei jeder Kleinzahlung Gebühren verloren.",
  },
];

export default function DriversPage() {
  return (
    <>
      <PageHeader
        eyebrow="Für Zusteller"
        title="Dein Einsatz verdient ein Danke."
        lead="Hol dir deinen persönlichen Lieferdank-Code und gib deinen Kunden eine einfache Möglichkeit, Danke zu sagen."
      />

      <div className="container-page max-w-5xl pb-24">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/register" className="btn btn-primary btn-lg w-full sm:w-auto">
            Kostenlos starten
            <ArrowRight className="h-[1.05rem] w-[1.05rem]" />
          </Link>
          <Link href="/so-funktionierts" className="btn btn-ghost btn-lg w-full sm:w-auto">
            So funktioniert&rsquo;s
          </Link>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="card-flat">
              <h2 className="font-bold text-ink">{benefit.title}</h2>
              <p className="mt-2 leading-relaxed text-ink-soft">{benefit.text}</p>
            </div>
          ))}
        </div>

        <section className="mt-16 rounded-3xl border border-brand-100 bg-brand-50 p-7 sm:p-9">
          <h2 className="text-lg font-extrabold text-brand-900">
            Wichtig für deinen Arbeitsalltag
          </h2>
          <ul className="mt-4 space-y-3 leading-relaxed text-brand-900/85">
            <li>
              Bitte beachte die Regeln deines Arbeitgebers bzw. Auftraggebers. Manche
              Unternehmen haben Vorgaben dazu, was du während der Arbeit sichtbar tragen
              darfst.
            </li>
            <li>
              Bitte niemanden aktiv um Trinkgeld. Lieferdank funktioniert dadurch, dass der
              Code sichtbar ist – die Entscheidung liegt beim Kunden.
            </li>
            <li>
              Trinkgeld kann steuerlich relevant sein. Wir stellen dir eine Übersicht deiner
              Einnahmen bereit; die steuerliche Behandlung klärst du selbst bzw. mit deiner
              Steuerberatung.
            </li>
          </ul>
        </section>

        <div className="mt-16 text-center">
          <Link href="/register" className="btn btn-primary btn-lg">
            Danke-Code erstellen
            <ArrowRight className="h-[1.05rem] w-[1.05rem]" />
          </Link>
        </div>
      </div>
    </>
  );
}
