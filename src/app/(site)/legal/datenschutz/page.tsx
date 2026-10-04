import Link from "next/link";
import { PageHeader, Prose } from "@/components/page-shell";
import { OPERATOR } from "@/lib/legal-content";

export const metadata = {
  title: "Datenschutz",
  robots: { index: false, follow: true },
  alternates: { canonical: "/legal/datenschutz" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Datenschutzhinweise" lead="Stand: 4. Oktober 2026" />
      <Prose>
        <h2>Grundsatz</h2>
        <p>
          Lieferdank erhebt so wenige personenbezogene Daten wie möglich. Kunden können ohne Konto und ohne App Danke
          sagen. Zusteller werden nicht überwacht und erhalten keine Bewertungen. Wir setzen keine Analyse- oder
          Werbewerkzeuge ein und treffen keine automatisierten Entscheidungen im Sinne von Art. 22 DSGVO.
        </p>

        <h2>Verantwortlicher</h2>
        <p>
          {OPERATOR.name}
          <br />
          {OPERATOR.street}
          <br />
          {OPERATOR.city}
          <br />
          {OPERATOR.country}
          <br />
          E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> · <Link href="/kontakt">Kontaktformular</Link>
        </p>

        <h2>Was wir wofür verarbeiten</h2>

        <h3>Aufruf der Website</h3>
        <p>
          Beim Aufruf verarbeitet unser Hosting-Dienstleister Vercel technisch die IP-Adresse, die aufgerufene Adresse,
          Zeitpunkt und Browserangaben, um die Seite auszuliefern und vor Angriffen zu schützen. Wir selbst speichern
          keine IP-Adressen in unserer Datenbank; zur Begrenzung von Missbrauch (zu viele Anfragen) halten wir sie nur
          kurzzeitig im Arbeitsspeicher. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren Betrieb
          (Art. 6 Abs. 1 lit. f DSGVO).
        </p>

        <h3>Danke senden (ohne Konto)</h3>
        <p>
          Wir speichern den Zeitpunkt, die Danke-Seite und – falls du eine schreibst – deine Nachricht (Vorlage oder bis
          zu 140 Zeichen Freitext). Der Zusteller sieht Danke und Nachricht, aber nicht, wer sie gesendet hat. Damit
          kostenlose Danke nicht vervielfacht werden, speichern wir zusätzlich einen pro Zusteller und Tag abgeleiteten
          Hash der Besucherkennung (siehe Cookies). Rechtsgrundlage ist die Erbringung der gewünschten Leistung (Art. 6
          Abs. 1 lit. b DSGVO) und unser berechtigtes Interesse an der Missbrauchsabwehr (lit. f). Die Daten bleiben
          gespeichert, solange das Konto des Zustellers besteht.
        </p>

        <h3>Trinkgeld</h3>
        <p>
          Die Zahlung läuft über Stripe Checkout. Zahlungsempfänger ist der Zusteller; Stripe wickelt die Zahlung für ihn
          ab, als Auftragsverarbeiter des Zahlungsempfängers und für eigene Zwecke wie Betrugsprävention und gesetzliche
          Pflichten als eigener Verantwortlicher (siehe die{" "}
          <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer">Datenschutzerklärung von Stripe</a>).
          Deine Zahlungsdaten wie Kartendaten erhält Lieferdank nicht. Der Zusteller sieht in seinem eigenen Stripe-Konto
          die Zahlungsangaben, die Stripe dort anzeigt.
        </p>
        <p>
          Lieferdank speichert zu jedem Trinkgeld Betrag, Zeitpunkt, Zahlart, Zahlungsstatus, die Kennungen des Vorgangs
          bei Stripe, die Aufteilung und gegebenenfalls erstattete Beträge, bei einem angemeldeten Kundenkonto auch die
          Zuordnung zu diesem Konto. Rechtsgrundlagen sind die Abwicklung (Art. 6 Abs. 1 lit. b DSGVO) und die
          gesetzlichen Aufbewahrungspflichten (lit. c, § 147 AO). Diese Buchungsdaten bewahren wir acht Jahre auf
          (Bücher und Aufzeichnungen zehn Jahre), jeweils ab dem Ende des Kalenderjahres.
        </p>

        <h3>Scans</h3>
        <p>
          Aufrufe einer Danke-Seite zählen wir als Scan. Gespeichert werden nur der Zeitpunkt und die aufgerufene
          Danke-Seite, keine IP-Adresse und keine Gerätekennung; mehrfache Aufrufe derselben Adresse innerhalb kurzer Zeit
          zählen einmal. Die Statistik dient dem Zusteller und uns (Art. 6 Abs. 1 lit. f DSGVO) und wird gelöscht, wenn
          das Konto des Zustellers gelöscht wird.
        </p>

        <h3>Kundenkonto (freiwillig)</h3>
        <ul>
          <li>E-Mail-Adresse, optional Vorname, Passwort (nur als Hash), Zeitpunkt der E-Mail-Bestätigung</li>
          <li>gespeicherte Lieblingslieferanten</li>
          <li>Danke und Trinkgelder, die du angemeldet sendest, werden deinem Konto zugeordnet</li>
        </ul>
        <p>Rechtsgrundlage ist der Nutzungsvertrag (Art. 6 Abs. 1 lit. b DSGVO).</p>

        <h3>Zusteller (auf der Website „Lieferanten“)</h3>
        <ul>
          <li>Name, E-Mail-Adresse, optional Telefonnummer, Zeitpunkt der E-Mail-Bestätigung</li>
          <li>Anzeigename und optional Stadt</li>
          <li>optional Profilfoto (ohne Metadaten wie Standortdaten gespeichert) und Profiltext</li>
          <li>Kartendesign und Benachrichtigungseinstellungen</li>
          <li>auf Wunsch Angaben zur Verifizierung der Zustellertätigkeit</li>
          <li>erhaltene Danke, Nachrichten, Trinkgeldbeträge, Scans und Meilensteine</li>
          <li>Kennung und Freischaltungsstatus des verbundenen Stripe-Kontos</li>
        </ul>
        <p>
          Öffentlich auf der Danke-Seite sichtbar sind der gewählte Anzeigename, das Profilfoto und der Profiltext, sofern
          freigegeben, sowie das Verifiziert-Abzeichen; die Stadt wird nicht öffentlich angezeigt. Zur Einrichtung des
          Stripe-Kontos übermitteln wir Name, E-Mail-Adresse, gegebenenfalls die Telefonnummer und die Adresse der eigenen
          Danke-Seite an Stripe, damit diese Angaben dort vorausgefüllt sind; Bank- und Identitätsdaten erhebt
          ausschließlich Stripe. Rechtsgrundlage ist der Nutzungsvertrag (Art. 6 Abs. 1 lit. b DSGVO).
        </p>

        <h3>E-Mails</h3>
        <p>
          Wir versenden Willkommens- und Bestätigungsmails, Passwort-Links, Vertragsbestätigungen, Hinweise zu
          Erstattungen, Mitteilungen zu einer Kontosperre, einem ersetzten Danke-Code oder einer Abzeichen-Anfrage
          und – abschaltbar – Benachrichtigungen über erhaltene Trinkgelder (Art. 6 Abs. 1 lit. b DSGVO).
        </p>

        <h3>Kontakt, Meldungen, Widerruf und Kündigung</h3>
        <p>
          Was du über das Kontaktformular, die Meldefunktion, die Widerrufs- oder Kündigungsfunktion oder per E-Mail
          mitteilst, verwenden wir zur Bearbeitung deines Anliegens und zur Erfüllung gesetzlicher Pflichten (Art. 6
          Abs. 1 lit. b, c und f DSGVO). Die Eingaben werden per E-Mail an unser Postfach übermittelt, nicht in der
          Datenbank gespeichert. Erledigte Anfragen löschen wir, sofern keine Aufbewahrungspflicht besteht; geschäftliche
          Korrespondenz bewahren wir bis zu sechs Jahre auf (§ 147 AO).
        </p>

        <h3>Sicherheit und Fehleranalyse</h3>
        <p>
          Technische Fehler- und Ereignisprotokolle enthalten interne Kennungen, etwa von Zahlungen, aber keine
          IP-Adressen. Wir löschen sie automatisch nach zwölf Monaten (Art. 6 Abs. 1 lit. f DSGVO). Links zum
          Zurücksetzen des Passworts gelten 60 Minuten; die zugehörigen Datensätze löschen wir nach 30 Tagen.
        </p>

        <h2>Löschung eines Kontos</h2>
        <p>
          Kontodaten speichern wir, solange das Konto besteht. Bei der Löschung eines Zustellerkontos entfernen wir Name,
          E-Mail-Adresse, Telefonnummer, Passwort, Profilfoto, Profiltexte, Kartendesign, Verifizierungsangaben, erhaltene
          Danke samt Nachrichten, Scans und Meilensteine und deaktivieren den Danke-Code dauerhaft. Trinkgeldbuchungen,
          Auszahlungen und die Kennung des Stripe-Kontos bleiben einem pseudonymisierten Datensatz zugeordnet, bis die
          Aufbewahrungsfristen abgelaufen sind, damit Erstattungen und Rückbuchungen bearbeitet werden können. Bei
          Kundenkonten löschen wir die gespeicherten Lieferanten und lösen gesendete Danke und Trinkgelder vom Konto.
        </p>

        <h2>Empfänger</h2>
        <ul>
          <li>
            Stripe (Stripe Payments Europe, Limited, Irland) als Zahlungsdienstleister, wie oben unter „Trinkgeld“
            beschrieben
          </li>
          <li>
            Vercel (Vercel Inc., USA) für das Hosting der Website; die Serverfunktionen laufen in der Region Frankfurt
          </li>
          <li>
            Supabase (Supabase Pte. Ltd., Singapur) für Datenbank und Dateispeicher (Profilfotos); das Projekt liegt in
            der Region Frankfurt
          </li>
          <li>Resend (Plus Five Five, Inc., USA) für den Versand von E-Mails; der Versand läuft über die Region Irland</li>
          <li>IONOS (IONOS SE, Deutschland) für das E-Mail-Postfach, über das wir Anfragen beantworten</li>
        </ul>
        <p>
          Vercel, Supabase, Resend und IONOS verarbeiten Daten in unserem Auftrag. Arbeitgeber und Zustelldienste erhalten
          keine personenbezogenen Auswertungen über einzelne Zusteller.
        </p>

        <h2>Übermittlung in Länder außerhalb der EU</h2>
        <p>
          Bei Stripe, Vercel, Supabase und Resend können personenbezogene Daten in Länder außerhalb der Europäischen Union
          übermittelt werden, insbesondere in die USA. Stripe, Vercel und Resend sind nach eigenen Angaben unter dem
          EU-U.S. Data Privacy Framework zertifiziert; für diese Übermittlungen gilt der Angemessenheitsbeschluss der
          EU-Kommission vom 10. Juli 2023 (Art. 45 DSGVO). Im Übrigen, insbesondere bei Supabase, stützen sich die
          Übermittlungen auf die Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO).
        </p>

        <h2>Cookies und Speicher im Browser</h2>
        <p>
          Wir setzen ausschließlich Cookies, die für den von dir gewünschten Dienst unbedingt erforderlich sind (§ 25
          Abs. 2 Nr. 2 TDDDG):
        </p>
        <ul>
          <li>
            <strong>ld_session</strong> – Anmeldung bei einem Zusteller-, Kunden- oder Admin-Konto (Speicherdauer:
            30 Tage oder bis zur Abmeldung).
          </li>
          <li>
            <strong>ld_visitor</strong> – Begrenzung kostenloser Danksagungen auf einmal pro Zusteller und Tag. Das anonyme
            Besucher-Cookie enthält eine zufällige, signierte Kennung (Speicherdauer: 90 Tage). In der Datenbank speichern
            wir nur einen pro Zusteller und Tag abgeleiteten Hash, keine Besucherkennung im Klartext. Durch Löschen des
            Cookies lässt sich die Begrenzung umgehen.
          </li>
          <li>
            <strong>ld_message_grant</strong> – erlaubt nur dem Browser, der ein Danke gesendet oder ein Trinkgeld
            gestartet hat, die optionale Nachricht dazu zu schreiben. Es enthält eine signierte Liste der letzten bis zu
            fünf eigenen Vorgänge (Speicherdauer: 24 Stunden).
          </li>
        </ul>
        <p>
          Damit Lieferdank auch als App auf dem Startbildschirm funktioniert, legt der Browser statische Dateien wie
          Schrift, Symbole und eine Offline-Seite in seinem Zwischenspeicher ab. Darin liegen keine personenbezogenen Daten.
        </p>

        <h2>Bereitstellung der Daten</h2>
        <p>
          Für ein Danke ohne Konto brauchst du keine Daten anzugeben. Für ein Konto sind E-Mail-Adresse und Passwort, für
          Zusteller zusätzlich der Name erforderlich; ohne sie können wir das Konto nicht führen. Für Trinkgeld verlangt
          Stripe die für die Zahlung nötigen Angaben.
        </p>

        <h2>Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit
          (Art. 15 bis 20 DSGVO). Zusteller und Kunden können ihre Daten jederzeit im eigenen Konto als Datei exportieren
          und ihr Konto selbst löschen. Für alle Anliegen genügt eine Nachricht über das{" "}
          <Link href="/kontakt">Kontaktformular</Link> oder an <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
        </p>
        <p>
          <strong>Widerspruchsrecht:</strong> Soweit wir Daten auf Grundlage berechtigter Interessen verarbeiten (Art. 6
          Abs. 1 lit. f DSGVO), kannst du aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit
          widersprechen (Art. 21 DSGVO).
        </p>
        <p>
          Du kannst dich bei einer Datenschutzaufsichtsbehörde beschweren (Art. 77 DSGVO). Für uns zuständig ist der
          Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg, Heilbronner Straße 35,
          70191 Stuttgart.
        </p>
      </Prose>
    </>
  );
}
