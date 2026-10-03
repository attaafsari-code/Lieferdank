import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-shell";
import { ArrowRight } from "@/components/icons";
import { cardOrdersAvailable } from "@/server/services/cards";

export const metadata: Metadata = {
  title: "Für Lieferanten",
  description:
    "Für Paketzusteller, Essenslieferanten und Kuriere: dein persönlicher Lieferdank-Code – kostenlos und sofort einsatzbereit.",
  alternates: { canonical: "/fahrer" },
};

const BENEFITS = [
  {
    title: "Kostenlos für dich",
    text: "Registrierung, digitaler Danke-Code und Dashboard kosten dich nichts. Bei Trinkgeld erhält Lieferdank je nach Betrag 0,50 €, 0,60 € oder 1,00 €. Stripe berechnet seine Kosten separat.",
  },
  {
    title: "Sofort einsatzbereit",
    text: "Nach der Registrierung hast du deinen QR-Code für kostenlose Danke. Für Trinkgeld muss zuerst dein Stripe-Konto freigeschaltet sein.",
  },
  {
    title: "Du bestimmst, was man sieht",
    text: "Nur Vorname, „Herr Müller“ oder voller Name. Foto ja oder nein. Jederzeit änderbar.",
  },
  {
    title: "Deine eigene Karte",
    text: "Gestalte deine Karte mit eigenem Text. Als Bild fürs Handy oder zum Ausdrucken.",
    orderableText: "Gestalte deine Karte mit eigenem Text. Als Bild fürs Handy, zum Ausdrucken oder als echte Plastikkarte.",
  },
  {
    title: "Der Code gehört dir",
    text: "Deine Lieferdank-ID bleibt bei dir, auch wenn du den Arbeitgeber wechselst. Kein Paketdienst kann sie dir wegnehmen.",
  },
  {
    title: "Nur Positives",
    text: "Keine Sterne, keine Bewertungen, keine Ranglisten. Kunden senden ein Danke, ein Trinkgeld oder eine kurze Nachricht.",
  },
  {
    title: "Keine Überwachung",
    text: "Wir liefern keine Leistungsdaten an Arbeitgeber. Was du verdienst, sehen nur du und – soweit gesetzlich nötig – die Buchhaltung.",
  },
  {
    title: "Auszahlung über Stripe",
    text: "Stripe verarbeitet dein Trinkgeld auf deinem verbundenen Konto und zahlt es nach deinem Stripe-Auszahlungsplan aus.",
  },
];

export default function DriversPage() {
  const cardsOrderable = cardOrdersAvailable();
  return (
    <>
      <PageHeader
        eyebrow="Für Paket-, Essens- und Kurierfahrer"
        title="Dein Einsatz verdient ein Danke."
        lead="Hol dir deinen persönlichen Lieferdank-Code und gib deinen Kunden eine einfache Möglichkeit, Danke zu sagen."
      />

      <div className="container-page max-w-5xl pb-24">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/register" className="btn btn-primary btn-lg w-full sm:w-auto">
            Als Lieferant starten
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
              <p className="mt-2 leading-relaxed text-ink-soft">{cardsOrderable && benefit.orderableText ? benefit.orderableText : benefit.text}</p>
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
            Als Lieferant starten
            <ArrowRight className="h-[1.05rem] w-[1.05rem]" />
          </Link>
        </div>
      </div>
    </>
  );
}
