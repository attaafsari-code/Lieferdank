import Link from "next/link";
import { PageHeader } from "@/components/page-shell";
import { cardOrdersAvailable } from "@/server/services/cards";

export const metadata = {
  title: "FAQ",
  description: "Häufige Fragen zu Lieferdank – für Lieferanten und für Kunden.",
  alternates: { canonical: "/faq" },
};

/** Antworten zu physischen Karten folgen der tatsächlichen Bestellbarkeit. */
const faqDrivers = (cardsOrderable: boolean) => [
  {
    q: "Was kostet mich Lieferdank?",
    a: `Registrierung, digitaler Danke-Code und Dashboard sind kostenlos. ${cardsOrderable ? "Physische Karten kosten extra." : "Physische Karten sind derzeit nicht bestellbar."} Für Trinkgeld fallen eine Lieferdank-Gebühr und separate Stripe-Kosten auf deinem Stripe-Konto an.`,
  },
  {
    q: "Wie viel bekomme ich vom Trinkgeld?",
    a: "Vor Stripe-Kosten: Bei 2 € verbleiben 1,50 €, bei 3 € 2,40 € und bei 5 € 4,00 €. Stripe zieht seine Zahlungs- und gegebenenfalls Auszahlungskosten separat ab. Deinen tatsächlichen Auszahlungsbetrag zeigt Stripe.",
  },
  {
    q: "Darf ich den Code während der Arbeit zeigen?",
    a: "Das hängt von den Regeln deines Arbeitgebers bzw. Auftraggebers ab. Lieferdank ist unabhängig von den Paketdiensten – bitte kläre das selbst und halte dich an die Vorgaben.",
  },
  {
    q: "Muss ich mich verifizieren lassen?",
    a: "Der Danke-Code und kostenlose Danke funktionieren sofort. Für Trinkgeld musst du die von Stripe verlangte Konto- und Identitätsprüfung abschließen.",
  },
  {
    q: "Welcher Name steht auf meiner Karte?",
    a: "Das entscheidest du: nur Vorname, Vorname mit Initial, voller Name, nur Nachname oder ein eigener Anzeigename wie „Herr Müller“. Du kannst das jederzeit ändern – dein QR-Code bleibt dabei derselbe.",
  },
  {
    q: "Muss ich ein Foto hochladen?",
    a: "Nein. Ohne Foto zeigen wir einen Avatar mit deinen Initialen. Wenn du eins hochlädst, kannst du es öffentlich zeigen oder nur im Dashboard behalten. Standortdaten werden beim Hochladen entfernt.",
  },
  {
    q: "Kann ich eine echte Karte bekommen?",
    a: cardsOrderable
      ? "Ja. Du kannst deine gestaltete Karte als Plastikkarte bestellen – oder sie selbst ausdrucken bzw. am Handy zeigen."
      : "Du kannst deine digitale Karte selbst ausdrucken oder am Handy zeigen. Physische Karten sind derzeit nicht bestellbar.",
  },
  {
    q: "Was bringt mir das Verifiziert-Abzeichen?",
    a: "Es ist freiwillig. Wenn wir deine Tätigkeit bestätigt haben, sehen Kunden auf deiner Seite „✓ Verifiziert“. Das schafft Vertrauen, ist aber keine Voraussetzung für irgendetwas.",
  },
  {
    q: "Sieht mein Arbeitgeber, was ich verdiene?",
    a: "Nein. Lieferdank gibt keine Leistungs- oder Einnahmedaten an Arbeitgeber weiter.",
  },
  {
    q: "Wann bekomme ich mein Geld?",
    a: "Stripe verwaltet das Guthaben auf deinem eigenen Stripe-Konto und zahlt gemäß deinem Stripe-Auszahlungsplan aus. Lieferdank führt keine Sammelauszahlung aus.",
  },
  {
    q: "Muss ich Trinkgeld versteuern?",
    a: "Das hängt von deiner persönlichen Situation ab. Wir stellen dir eine Übersicht deiner Einnahmen bereit; die steuerliche Bewertung klärst du bitte selbst oder mit deiner Steuerberatung.",
  },
  {
    q: "Was passiert, wenn ich den Job wechsle?",
    a: "Dein Lieferdank-Code bleibt deiner, auch wenn du den Job wechselst.",
  },
];

const FAQ_CUSTOMERS = [
  {
    q: "Brauche ich eine App?",
    a: "Nein. Du scannst den QR-Code mit der normalen Handykamera und landest direkt auf der Seite.",
  },
  {
    q: "Muss ich mich registrieren?",
    a: "Nein. Weder für ein Danke noch für ein Trinkgeld brauchst du ein Konto.",
  },
  {
    q: "Wie kann ich bezahlen?",
    a: "Mit Karte und – bei geeignetem Gerät und Stripe-Konto – Apple Pay oder Google Pay. Lieferdank sieht deine Kartendaten nie. PayPal ist noch nicht eingerichtet.",
  },
  {
    q: "Kann ich Lieferanten speichern?",
    a: "Ja, mit einem kostenlosen Kundenkonto. Dann findest du deine Lieblingslieferanten jederzeit wieder. Der Lieferant sieht nicht, wer ihn gespeichert hat.",
  },
  {
    q: "Kostet Danke sagen etwas?",
    a: "Nein, ein Danke ist immer kostenlos. Trinkgeld ist freiwillig und nie Voraussetzung.",
  },
  {
    q: "Zahle ich zusätzliche Gebühren?",
    a: "Nein. Du zahlst exakt den Betrag, den du auswählst. Es kommt nichts obendrauf. Vom gewählten Betrag werden lediglich Zahlungs- und Plattformkosten abgezogen.",
  },
  {
    q: "Kommt das Geld wirklich beim Lieferanten an?",
    a: "Ja. Die Auszahlung läuft über einen regulierten Zahlungsdienstleister direkt auf das Konto des Lieferanten. Dessen Identität wird dabei geprüft.",
  },
  {
    q: "Kann ich mich beschweren?",
    a: "Nicht über Lieferdank – wir sind bewusst kein Bewertungsportal. Bei Problemen mit einer Sendung wende dich bitte an den jeweiligen Paketdienst.",
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="Hilfe"
        title="Häufige Fragen"
        lead="Alles, was Lieferanten und Kunden vor dem ersten Danke wissen wollen."
      />
      <div className="container-page max-w-3xl pb-24">
        <Group title="Für Lieferanten" items={faqDrivers(cardOrdersAvailable())} />
        <Group title="Für Kunden" items={FAQ_CUSTOMERS} />

        <p className="mt-16 text-center text-ink-soft">
          Noch eine Frage?{" "}
          <Link href="/legal/impressum" className="font-semibold text-brand underline underline-offset-2">
            Kontakt im Impressum
          </Link>
        </p>
      </div>
    </>
  );
}

function Group({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  return (
    <section className="mt-14 first:mt-0">
      <h2 className="mb-5 text-xl font-extrabold text-brand-900">{title}</h2>
      <div className="space-y-2.5">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-line bg-white px-5 py-4 shadow-xs transition open:shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-ink marker:content-['']">
              {item.q}
              <span
                aria-hidden
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-canvas text-ink-soft transition group-open:rotate-45 group-open:bg-brand-50 group-open:text-brand"
              >
                +
              </span>
            </summary>
            <p className="mt-3 leading-relaxed text-ink-soft">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
