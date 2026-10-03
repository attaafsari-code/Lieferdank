import Link from "next/link";
import { PageHeader, Prose } from "@/components/page-shell";
import { DraftNotice } from "@/components/legal-notice";
import { OPERATOR, TIP_FEE_SUMMARY, TIPPING_SERVICE_NAME, WITHDRAWAL_FORM_LINES, withdrawalInstructions } from "@/lib/legal-content";
import { canonicalBase } from "@/server/site";

export const metadata = {
  title: "AGB",
  robots: { index: false, follow: true },
  alternates: { canonical: "/legal/agb" },
};

export default function TermsPage() {
  const withdrawUrl = `${canonicalBase()}/vertrag-widerrufen`;
  return (
    <>
      <PageHeader title="Allgemeine Geschäftsbedingungen" lead="Stand: 3. Oktober 2026" />
      <Prose>
        {/* Bleibt, bis die Telefonnummer für die Verbraucherinformationen vorliegt (Art. 246a § 1 Abs. 1 Nr. 3 EGBGB). */}
        {!OPERATOR.phone && <DraftNotice />}

        <h2>1. Geltungsbereich und Anbieter</h2>
        <p>
          Diese Bedingungen gelten für die Nutzung der Plattform Lieferdank durch Zusteller, auf der Website auch
          „Lieferanten“ genannt („Empfänger“), und durch Kundinnen und Kunden, die ein Danke oder ein Trinkgeld
          senden („Sender“). Anbieter der Plattform ist {OPERATOR.name}, {OPERATOR.street}, {OPERATOR.city},{" "}
          {OPERATOR.country} (E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
          {OPERATOR.phone ? `, Telefon: ${OPERATOR.phone}` : ""}).
        </p>

        <h2>2. Leistungen und Vertragsschluss</h2>
        <p>
          Lieferdank stellt eine technische Plattform bereit, über die Sender einem Zusteller ein kostenloses Danke,
          ein freiwilliges Trinkgeld und optional eine kurze Nachricht zukommen lassen können. Lieferdank erbringt
          selbst keine Zustellleistung und ist nicht Vertragspartner des Transportvertrags.
        </p>
        <p>
          Kostenlos sind: Danke senden, ein Kundenkonto, für Zusteller das Konto mit Danke-Code, Karte und Dashboard
          sowie der Empfang kostenloser Danke. Der Vertrag über diese Nutzung kommt zustande, wenn du die Registrierung
          mit „Danke-Code erstellen“ bzw. „Konto erstellen“ abschließt.
        </p>
        <p>
          Entgeltlich ist für Zusteller die {TIPPING_SERVICE_NAME} (Ziffer 5). Dieser Vertrag kommt zustande, wenn du
          nach Bestätigung deiner E-Mail-Adresse im Dashboard ausdrücklich den sofortigen Beginn verlangst und auf
          „Trinkgeld zahlungspflichtig aktivieren“ klickst. Danach richtest du bei Stripe dein Auszahlungskonto ein.
          Du erhältst eine Vertragsbestätigung mit Widerrufsbelehrung per E-Mail.
        </p>
        <p>
          Eingaben kannst du vor dem Absenden in den Formularfeldern prüfen und korrigieren, Profilangaben später jederzeit
          im Konto ändern. Wir speichern deine Kontoangaben; die jeweils geltenden Bedingungen kannst du hier abrufen,
          drucken und speichern. Vertragssprache ist Deutsch.
        </p>

        <h2>3. Mindestalter</h2>
        <p>Ein Zusteller- oder Kundenkonto darf nur anlegen, wer mindestens 18 Jahre alt ist.</p>

        <h2>4. Danke und Trinkgeld</h2>
        <p>
          Ein Danke ist stets kostenlos. Ein Trinkgeld ist eine freiwillige Zuwendung des Senders an den Zusteller ohne
          Gegenleistung und niemals Voraussetzung für eine Zustellung. Zusteller dürfen Trinkgeld nicht einfordern.
        </p>
        <p>
          Zahlungsempfänger des Trinkgelds ist der Zusteller. Die Zahlung wickelt der Zahlungsdienstleister Stripe direkt
          auf dem Stripe-Konto des Zustellers ab. Lieferdank nimmt Trinkgelder nicht selbst entgegen und verwahrt keine
          Kundengelder. Der Sender zahlt exakt den ausgewählten Betrag (2 €, 3 € oder 5 €); es werden keine zusätzlichen
          Gebühren aufgeschlagen. Für den Sender ist die Nutzung von Lieferdank kostenlos.
        </p>

        <h2>5. {TIPPING_SERVICE_NAME} und Gebühren</h2>
        <p>
          Mit der {TIPPING_SERVICE_NAME} können Sender dem Zusteller über seinen Danke-Code Trinkgeld geben. Je erhaltenem
          Trinkgeld erhält Lieferdank eine Gebühr ({TIP_FEE_SUMMARY}); Stripe behält sie vom Trinkgeld ein und leitet sie
          an Lieferdank weiter (bei Stripe „Application Fee“). Die Beträge sind Gesamtbeträge; weitere Kosten berechnet
          Lieferdank nicht.
        </p>
        <p>
          Für sein Stripe-Konto schließt der Zusteller einen eigenen Vertrag mit Stripe. Stripe berechnet seine Zahlungs-
          und gegebenenfalls Auszahlungskosten nach diesen Bedingungen separat auf dem Stripe-Konto des Zustellers und zahlt
          das Guthaben nach dessen Auszahlungsplan aus. Voraussetzung für Trinkgeld ist ein für Zahlungen und Auszahlungen
          freigeschaltetes Stripe-Konto. Für die {TIPPING_SERVICE_NAME} als digitale Dienstleistung gilt das gesetzliche
          Gewährleistungsrecht.
        </p>

        <h2 id="rueckerstattungen" className="scroll-mt-24">6. Erstattungen und Rückbuchungen</h2>
        <p>
          Bei einer irrtümlichen, doppelten oder nicht autorisierten Zahlung wende dich bitte unverzüglich über das{" "}
          <Link href="/kontakt">Kontaktformular</Link> oder an <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
          Gesetzliche Ansprüche bleiben unberührt.
        </p>
        <p>
          Der Zusteller ermächtigt Lieferdank, über Stripe ein Trinkgeld ganz oder teilweise zu erstatten, wenn die
          Zahlung doppelt oder irrtümlich erfolgt ist, auf Betrug oder der nicht autorisierten Nutzung eines
          Zahlungsmittels beruht oder der Zusteller die Erstattung verlangt. Lieferdank informiert den Zusteller über jede
          solche Erstattung und ihren Grund per E-Mail. Der Zusteller kann Trinkgelder auch selbst in seinem Stripe-Konto
          erstatten.
        </p>
        <p>
          Der erstattete Betrag wird dem Stripe-Konto des Zustellers belastet. Lieferdank gibt seine Gebühr bei
          vollständiger Erstattung vollständig und bei teilweiser Erstattung anteilig zurück – auch wenn der Zusteller die
          Erstattung selbst auslöst. Für die Zahlungskosten von Stripe gelten die Bedingungen von Stripe. Rückbuchungen
          über den Zahlungsdienstleister (Chargebacks) richten sich nach den Bedingungen von Stripe, belasten das
          Stripe-Konto des Zustellers und werden nicht automatisch verrechnet, sondern einzeln geprüft.
        </p>

        <h2>7. Pflichten der Zusteller</h2>
        <ul>
          <li>Angaben zur Person müssen zutreffen.</li>
          <li>Die Regeln des jeweiligen Arbeitgebers bzw. Auftraggebers sind eigenverantwortlich zu beachten.</li>
          <li>Kunden dürfen nicht aktiv um Trinkgeld gebeten werden.</li>
          <li>Steuerliche und sozialversicherungsrechtliche Pflichten aus erhaltenen Trinkgeldern liegen beim Zusteller.</li>
        </ul>

        <h2>8. Inhalte, Nachrichten und Meldungen</h2>
        <p>
          Für Profilangaben, Fotos, Texte und Nachrichten ist verantwortlich, wer sie einstellt. Unzulässig sind
          rechtswidrige Inhalte, insbesondere Beleidigungen, Bedrohungen, Diskriminierung, Inhalte, die Rechte Dritter
          verletzen, Werbung sowie personenbezogene Daten anderer Personen ohne deren Einwilligung. Es gibt keine
          Bewertungen, Sterne, Ranglisten oder Beschwerdefunktionen.
        </p>
        <p>
          Lieferdank prüft Inhalte nicht vorab und setzt keine automatisierte Moderation ein. Wir werden auf Meldungen
          oder eigene Kenntnis hin tätig; jede Entscheidung trifft ein Mensch. Rechtswidrige Inhalte kann jede Person
          über <Link href="/kontakt?anliegen=meldung">„Rechtswidrigen Inhalt melden“</Link> melden. Wir bestätigen den
          Eingang, prüfen die Meldung zügig, sorgfältig und objektiv und teilen der meldenden Person unsere Entscheidung mit.
        </p>
        <p>
          Wir können unzulässige Inhalte entfernen, ein Profil oder einen Danke-Code deaktivieren oder ein Konto sperren.
          Betroffene erhalten eine Begründung per E-Mail und können über das Kontaktformular eine erneute Prüfung
          verlangen. Der Rechtsweg zu den Gerichten bleibt offen.
        </p>

        <h2>9. E-Mail-Bestätigung, Verifizierung und Sperrung</h2>
        <p>
          Die {TIPPING_SERVICE_NAME} setzt eine bestätigte E-Mail-Adresse voraus. Stripe prüft die für Zahlungsannahme
          und Auszahlung erforderlichen Kontoinformationen. Ein optionales Lieferdank-Abzeichen für die
          Zustellertätigkeit ist davon getrennt. Bei begründetem Verdacht auf Missbrauch, falsche Angaben oder
          betrügerische Zahlungen kann Lieferdank Konten sperren, Codes neu vergeben und die Annahme neuer Trinkgelder
          unterbinden.
        </p>

        <h2>10. Haftung</h2>
        <p>
          Lieferdank haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung des Lebens, des Körpers
          oder der Gesundheit, nach dem Produkthaftungsgesetz und soweit eine Garantie übernommen wurde.
        </p>
        <p>
          Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht – einer Pflicht, deren Erfüllung die
          ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung du regelmäßig
          vertrauen darfst – ist die Haftung auf den vorhersehbaren, vertragstypischen Schaden begrenzt. Im Übrigen ist
          die Haftung für leichte Fahrlässigkeit ausgeschlossen. Gesetzliche Gewährleistungsrechte für digitale
          Dienstleistungen bleiben unberührt.
        </p>

        <h2>11. Laufzeit und Kündigung</h2>
        <p>
          Die Verträge laufen unbefristet und ohne Mindestlaufzeit. Du kannst dein Konto oder nur die{" "}
          {TIPPING_SERVICE_NAME} jederzeit ohne Frist kündigen – über{" "}
          <Link href="/vertrag-kuendigen">„Verträge hier kündigen“</Link>, per E-Mail oder indem du dein Konto im
          Profil löschst. Sind bei einem Zusteller noch Zahlungen oder Erstattungen offen, ist die Löschung erst nach
          deren Klärung möglich. Bereits eingegangene Zahlungen, Erstattungen und Auszahlungen bleiben bei Stripe zu
          klären und unterliegen dessen Kontobedingungen.
        </p>
        <p>
          Lieferdank kann mit einer Frist von vier Wochen per E-Mail kündigen. Das Recht zur außerordentlichen Kündigung
          aus wichtigem Grund, etwa bei Missbrauch, bleibt unberührt.
        </p>

        <h2>12. Änderungen dieser Bedingungen</h2>
        <p>
          Änderungen bieten wir registrierten Nutzern mindestens vier Wochen vor ihrem Inkrafttreten per E-Mail an. Sie
          werden nur wirksam, wenn du zustimmst. Stimmst du nicht zu, gelten die bisherigen Bedingungen weiter; beide
          Seiten können den Vertrag dann nach Ziffer 11 kündigen.
        </p>

        <h2 id="widerruf" className="scroll-mt-24">13. Widerrufsbelehrung für die {TIPPING_SERVICE_NAME}</h2>
        <p>
          Zustellern, die Verbraucher sind, steht für die {TIPPING_SERVICE_NAME} das folgende Widerrufsrecht zu. Für die
          kostenlosen Leistungen besteht kein Widerrufsrecht, weil dafür kein Preis zu zahlen ist.
        </p>
        <h3>Widerrufsbelehrung</h3>
        {withdrawalInstructions(withdrawUrl).map((section) => (
          <div key={section.heading}>
            <h3>{section.heading}</h3>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        ))}
        <p>
          Online widerrufen: <Link href="/vertrag-widerrufen">Vertrag widerrufen</Link>.
        </p>
        <h3>Muster-Widerrufsformular</h3>
        {WITHDRAWAL_FORM_LINES.map((line) => <p key={line}>{line}</p>)}

        <h2>14. Schlussbestimmungen</h2>
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland. Bist du Verbraucher, gilt diese Rechtswahl nur, soweit dir
          dadurch nicht der Schutz zwingender Bestimmungen des Staates entzogen wird, in dem du deinen gewöhnlichen
          Aufenthalt hast. Für Gerichtsstände gelten die gesetzlichen Vorschriften.
        </p>
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Prose>
    </>
  );
}
