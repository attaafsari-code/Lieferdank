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
        <p>
          Atta Afsari Gargari
          <br />
          Dürkheimerstraße 2
          <br />
          76187 Karlsruhe
          <br />
          Deutschland
          <br />
          E-Mail: <a href="mailto:info@lieferdank.de">info@lieferdank.de</a>
        </p>

        <h2>Welche Daten wir verarbeiten</h2>
        <h3>Kunden (Danke sagen und Trinkgeld)</h3>
        <ul>
          <li>Zeitpunkt des Danke; bei Trinkgeld Betrag, Zahlungsart, Zahlungsstatus, Kennungen des
            Vorgangs bei Stripe und gegebenenfalls erstattete Beträge</li>
          <li>optional gewählte Nachricht oder kurzer Freitext (bis 140 Zeichen); der Lieferant sieht
            die Nachricht, aber nicht, wer sie gesendet hat</li>
          <li>Zahlungsdaten wie Kartendaten ausschließlich beim Zahlungsdienstleister, nicht bei uns</li>
          <li>die IP-Adresse nur kurzzeitig im Arbeitsspeicher, um Missbrauch wie massenhafte
            Anfragen zu begrenzen; in unserer Datenbank speichern wir sie nicht</li>
        </ul>
        <p>
          Aufrufe einer Danke-Seite zählen wir als Scan. Gespeichert werden nur der Zeitpunkt und
          die aufgerufene Danke-Seite, keine IP-Adresse und keine Gerätekennung.
        </p>
        <p>
          Ohne Kundenkonto speichern wir kein Kundenprofil und ordnen einzelne Zahlungen keiner
          identifizierbaren Person zu.
        </p>

        <h3>Kundenkonto (freiwillig)</h3>
        <ul>
          <li>E-Mail-Adresse, optional Vorname, Passwort (nur als Hash), Zeitpunkt der
            E-Mail-Bestätigung</li>
          <li>gespeicherte Lieblingslieferanten</li>
          <li>Danke und Trinkgelder, die du angemeldet sendest, werden deinem Konto zugeordnet</li>
        </ul>

        <h3>Zusteller (auf der Website „Lieferanten“)</h3>
        <ul>
          <li>Name, E-Mail-Adresse, optional Telefonnummer, Zeitpunkt der E-Mail-Bestätigung</li>
          <li>Anzeigename und optional Stadt</li>
          <li>optional Profilfoto (beim Hochladen ohne Metadaten wie Standortdaten gespeichert) und
            Profiltext</li>
          <li>Angaben zur Verifizierung der Zustellertätigkeit</li>
          <li>erhaltene Danke, Nachrichten und Trinkgeldbeträge</li>
          <li>Kennung und Freischaltungsstatus des verbundenen Stripe-Kontos</li>
          <li>Bank- und Identitätsdaten ausschließlich beim Zahlungsdienstleister</li>
        </ul>
        <p>
          Zur Einrichtung des Stripe-Kontos übermitteln wir Name, E-Mail-Adresse, gegebenenfalls
          die Telefonnummer und die Adresse der eigenen Danke-Seite an Stripe, damit diese Angaben
          dort vorausgefüllt sind. Öffentlich auf der Danke-Seite sichtbar sind der gewählte
          Anzeigename, das Profilfoto und der Profiltext, sofern freigegeben, sowie das
          Verifiziert-Abzeichen. Die Stadt wird nicht öffentlich angezeigt.
        </p>

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
          <li>
            Stripe (Stripe Payments Europe, Limited, Irland) als Zahlungsdienstleister für
            Zahlungsabwicklung und Auszahlungen
          </li>
          <li>
            Vercel (Vercel Inc., USA) für das Hosting der Website; die Serverfunktionen laufen in
            der Region Frankfurt. Vercel verarbeitet beim Aufruf technisch die IP-Adresse.
          </li>
          <li>
            Supabase (Supabase Pte. Ltd., Singapur) für Datenbank und Dateispeicher (Profilfotos);
            das Projekt liegt in der Region Frankfurt
          </li>
          <li>
            Resend (Plus Five Five, Inc., USA) für den Versand von E-Mails: Willkommens- und
            Bestätigungsmails, Passwort-Links und – abschaltbar – Benachrichtigungen über erhaltene
            Trinkgelder; der Versand läuft über die Region Irland
          </li>
          <li>IONOS (IONOS SE, Deutschland) für das E-Mail-Postfach, über das wir Anfragen beantworten</li>
        </ul>
        <p>
          Arbeitgeber und Zustelldienste erhalten keine personenbezogenen Auswertungen über
          einzelne Zusteller.
        </p>

        <h2>Übermittlung in Länder außerhalb der EU</h2>
        <p>
          Stripe, Vercel, Supabase und Resend haben ihren Sitz außerhalb der EU oder gehören zu
          Unternehmensgruppen mit Sitz in den USA. Bei der Nutzung dieser Dienste können
          personenbezogene Daten in Länder außerhalb der Europäischen Union übermittelt werden,
          insbesondere in die USA.
        </p>
        <p>
          Nach eigenen Angaben stützen diese Anbieter solche Übermittlungen auf die
          Standardvertragsklauseln der EU-Kommission. Stripe, Vercel und Resend geben zusätzlich
          an, am EU-U.S. Data Privacy Framework teilzunehmen.
        </p>

        <h2>Speicherdauer</h2>
        <p>
          Kontodaten speichern wir, solange das Konto besteht. Bei der Löschung eines Kontos
          entfernen wir Name, E-Mail-Adresse, Telefonnummer, Passwort, Profilfoto und Profiltexte
          und deaktivieren den Danke-Code dauerhaft. Erhaltene Danke einschließlich Nachrichten,
          Trinkgeldbuchungen und die Kennung des Stripe-Kontos bleiben einem pseudonymisierten
          Datensatz zugeordnet, damit Erstattungen, Rückbuchungen und Aufbewahrungspflichten
          erfüllt werden können. Bei Kundenkonten löschen wir die gespeicherten Lieferanten und
          lösen gesendete Danke und Trinkgelder vom Konto.
          {/* REVIEW (RECHTSTEXT-REVIEW.md, Nr. 9): konkrete Aufbewahrungsfristen und deren Rechtsgrundlage festlegen. */}
        </p>
        <p>
          Technische Fehler- und Ereignisprotokolle enthalten interne Kennungen, etwa von
          Zahlungen, aber keine IP-Adressen.
        </p>

        <h2>Deine Rechte</h2>
        <p>
          Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und
          Widerspruch. Zusteller und Kunden können ihre Daten jederzeit im eigenen Konto als
          Datei exportieren und ihr Konto selbst löschen. Für alle Anliegen genügt eine E-Mail an{" "}
          <a href="mailto:info@lieferdank.de">info@lieferdank.de</a>. Es besteht ein
          Beschwerderecht bei einer Datenschutzaufsichtsbehörde.
        </p>

        <h2>Cookies und Speicher im Browser</h2>
        <p>Wir setzen ausschließlich technisch notwendige Cookies:</p>
        <ul>
          <li>
            <strong>ld_session</strong> – Anmeldung bei einem Zusteller-, Kunden- oder Admin-Konto
            (Speicherdauer: 30 Tage oder bis zur Abmeldung).
          </li>
          <li>
            <strong>ld_visitor</strong> – Begrenzung kostenloser Danksagungen auf einmal pro Zusteller
            und Tag. Das anonyme Besucher-Cookie enthält eine zufällige, signierte Kennung
            (Speicherdauer: 90 Tage). In der Datenbank speichern wir nur einen pro Zusteller und
            Tag abgeleiteten Hash, keine Besucherkennung im Klartext. Durch Löschen des Cookies
            lässt sich die Begrenzung umgehen.
          </li>
          <li>
            <strong>ld_message_grant</strong> – erlaubt nur dem Browser, der ein Danke gesendet oder
            ein Trinkgeld gestartet hat, die optionale Nachricht dazu zu schreiben. Es enthält eine
            signierte Liste der letzten bis zu fünf eigenen Vorgänge (Speicherdauer: 24 Stunden).
          </li>
        </ul>
        <p>
          Damit Lieferdank auch als App auf dem Startbildschirm funktioniert, legt der Browser
          statische Dateien wie Schrift, Symbole und eine Offline-Seite in seinem Zwischenspeicher
          ab. Darin liegen keine personenbezogenen Daten. Für Kunden ist keine Anmeldung nötig.
          Wir verwenden kein Tracking, keine Analysewerkzeuge und keine Werbecookies.
        </p>
        {/* REVIEW (RECHTSTEXT-REVIEW.md, Nr. 10): Rechtsgrundlage für Cookies (§ 25 TDDDG) ergänzen. */}
      </Prose>
    </>
  );
}
