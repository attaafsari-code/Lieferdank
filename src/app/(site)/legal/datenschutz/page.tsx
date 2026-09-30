import { PageHeader, Prose } from "@/components/page-shell";
import { DraftNotice } from "@/components/legal-notice";

export const metadata = {
  title: "Datenschutz",
  robots: { index: false, follow: true },
  alternates: { canonical: "/legal/datenschutz" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Datenschutzhinweise" />
      <Prose>
        <DraftNotice />

        <h2>Grundsatz</h2>
        <p>
          Lieferdank erhebt so wenige personenbezogene Daten wie möglich. Kunden können ohne
          Konto und ohne App Danke sagen. Zusteller werden nicht überwacht und erhalten keine
          Bewertungen.
        </p>

        <h2>Verantwortlicher</h2>
        <p>[Firmenname, Anschrift, E-Mail – siehe Impressum]</p>

        <h2>Welche Daten wir verarbeiten</h2>
        <h3>Kunden (Danke sagen und Trinkgeld)</h3>
        <ul>
          <li>Zeitpunkt und Betrag der Zahlung</li>
          <li>optional gewählte Nachricht oder kurzer Freitext</li>
          <li>Zahlungsdaten ausschließlich beim Zahlungsdienstleister, nicht bei uns</li>
          <li>technische Zugriffsdaten (IP-Adresse) zur Abwehr von Missbrauch</li>
        </ul>
        <p>
          Wir speichern keine Kundenprofile und ordnen einzelne Zahlungen keiner
          identifizierbaren Person zu.
        </p>

        <h3>Zusteller</h3>
        <ul>
          <li>Name, E-Mail-Adresse, optional Telefonnummer</li>
          <li>Anzeigename, Zustelldienst und optional Stadt</li>
          <li>Angaben zur Verifizierung der Zustellertätigkeit</li>
          <li>erhaltene Danke, Nachrichten und Trinkgeldbeträge</li>
          <li>Auszahlungsdaten ausschließlich beim Zahlungsdienstleister</li>
        </ul>

        <h2>Rechtsgrundlagen</h2>
        <ul>
          <li>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) für Konto und Auszahlung</li>
          <li>
            berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) für Betrugsprävention und
            Sicherheit
          </li>
          <li>rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO) für Aufbewahrungsfristen</li>
        </ul>

        <h2>Empfänger</h2>
        <ul>
          <li>Zahlungsdienstleister [Anbieter] für Zahlungsabwicklung und Auszahlungen</li>
          <li>Hosting- und Datenbankdienstleister [Anbieter]</li>
        </ul>
        <p>
          Arbeitgeber und Zustelldienste erhalten keine personenbezogenen Auswertungen über
          einzelne Zusteller.
        </p>

        <h2>Speicherdauer</h2>
        <p>
          Kontodaten speichern wir, solange das Konto besteht. Nach der Löschung entfernen wir
          personenbezogene Angaben; Zahlungsvorgänge bleiben aus handels- und steuerrechtlichen
          Gründen anonymisiert erhalten.
        </p>

        <h2>Deine Rechte</h2>
        <p>
          Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und
          Widerspruch. Zusteller können ihre Daten jederzeit im Profil als Datei exportieren
          und ihr Konto selbst löschen. Es besteht ein Beschwerderecht bei einer
          Datenschutzaufsichtsbehörde.
        </p>

        <h2>Cookies</h2>
        <p>
          Wir setzen technisch notwendige Cookies für die Anmeldung von Zustellern und für die
          Begrenzung kostenloser Danksagungen auf einmal pro Zusteller und Tag. Das anonyme
          Besucher-Cookie enthält eine zufällige, signierte Kennung (Speicherdauer: 90 Tage).
          In der Datenbank speichern wir nur einen pro Zusteller und Tag abgeleiteten Hash,
          keine Besucherkennung im Klartext. Für Kunden ist keine Anmeldung nötig. Wir verwenden
          kein Tracking und keine Werbecookies. Durch Löschen des Cookies lässt sich die
          Begrenzung umgehen.
        </p>
      </Prose>
    </>
  );
}
