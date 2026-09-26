import Link from "next/link";
import { PageHeader } from "@/components/page-shell";
import { formatEuro } from "@/lib/format";
import { PLATFORM_GROSS_FEE_CENTS } from "@/lib/money";

export const metadata = {
  title: "FAQ",
  description: "Häufige Fragen zu Lieferdank – für Zusteller und für Kunden.",
  alternates: { canonical: "/faq" },
};

const FAQ_DRIVERS = [
  {
    q: "Was kostet mich Lieferdank?",
    a: "Nichts. Registrierung, Danke-Code, Karte und Dashboard sind kostenlos. Wir behalten nur bei einer freiwilligen Trinkgeldzahlung einen festen Anteil ein.",
  },
  {
    q: "Wie viel bekomme ich vom Trinkgeld?",
    a: `Pro Zahlung werden ${formatEuro(PLATFORM_GROSS_FEE_CENTS)} für Zahlungsabwicklung und Lieferdank einbehalten. Bei 2 € bekommst du also 1,50 €, bei 3 € sind es 2,50 € und bei 5 € sind es 4,50 €.`,
  },
  {
    q: "Darf ich den Code während der Arbeit zeigen?",
    a: "Das hängt von den Regeln deines Arbeitgebers bzw. Auftraggebers ab. Lieferdank ist unabhängig von den Paketdiensten – bitte kläre das selbst und halte dich an die Vorgaben.",
  },
  {
    q: "Muss ich mich verifizieren lassen?",
    a: "Nein. Du kannst dich registrieren und sofort loslegen – Danke-Code und Danke-Funktion sind ohne Prüfung nutzbar. Nur für die Auszahlung prüft unser Zahlungsdienstleister deine Identität, so wie es bei jedem Konto gesetzlich vorgeschrieben ist.",
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
    a: "Ja. Du kannst deine gestaltete Karte als Plastikkarte bestellen – oder sie selbst ausdrucken bzw. am Handy zeigen.",
  },
  {
    q: "Was bringt mir das Verifiziert-Abzeichen?",
    a: "Es ist freiwillig. Wenn wir deine Zustellertätigkeit bestätigt haben, sehen Kunden auf deiner Seite „✓ Verifizierter Zusteller“. Das schafft Vertrauen, ist aber keine Voraussetzung für irgendetwas.",
  },
  {
    q: "Sieht mein Arbeitgeber, was ich verdiene?",
    a: "Nein. Lieferdank gibt keine Leistungs- oder Einnahmedaten an Arbeitgeber weiter.",
  },
  {
    q: "Wann bekomme ich mein Geld?",
    a: "Dein Trinkgeld sammelt sich als Guthaben und wird gebündelt ausgezahlt. Einzelne Kleinstauszahlungen würden unnötig Gebühren kosten.",
  },
  {
    q: "Muss ich Trinkgeld versteuern?",
    a: "Das hängt von deiner persönlichen Situation ab. Wir stellen dir eine Übersicht deiner Einnahmen bereit; die steuerliche Bewertung klärst du bitte selbst oder mit deiner Steuerberatung.",
  },
  {
    q: "Was passiert, wenn ich den Job wechsle?",
    a: "Dein Lieferdank-Code bleibt deiner. Du änderst im Profil einfach den Zustelldienst.",
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
    a: "Mit Apple Pay, Google Pay, PayPal oder Karte – abgewickelt von einem regulierten Zahlungsdienstleister. Lieferdank sieht deine Kartendaten nie.",
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
    a: "Nein. Du zahlst exakt den Betrag, den du auswählst. Es kommt nichts obendrauf.",
  },
  {
    q: "Kommt das Geld wirklich beim Zusteller an?",
    a: "Ja. Die Auszahlung läuft über einen regulierten Zahlungsdienstleister direkt auf das Konto des Zustellers. Dessen Identität wird dabei geprüft.",
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
        <Group title="Für Lieferanten" items={FAQ_DRIVERS} />
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
