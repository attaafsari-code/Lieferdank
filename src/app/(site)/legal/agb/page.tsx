import { PageHeader, Prose } from "@/components/page-shell";
import { DraftNotice } from "@/components/legal-notice";

export const metadata = {
  title: "AGB",
  robots: { index: false, follow: true },
  alternates: { canonical: "/legal/agb" },
};

export default function TermsPage() {
  return (
    <>
      <PageHeader title="Allgemeine Geschäftsbedingungen" />
      <Prose>
        <DraftNotice />

        <h2>1. Geltungsbereich</h2>
        <p>
          Diese Bedingungen gelten für die Nutzung der Plattform Lieferdank durch Zusteller
          („Empfänger“) und durch Kundinnen und Kunden, die ein Danke oder ein Trinkgeld
          senden („Sender“).
        </p>
        <p>
          Anbieter der Plattform ist Atta Afsari Gargari, Dürkheimerstraße 2, 76187 Karlsruhe,
          Deutschland (E-Mail: <a href="mailto:info@lieferdank.de">info@lieferdank.de</a>).
        </p>

        <h2>2. Leistung von Lieferdank</h2>
        <p>
          Lieferdank stellt eine technische Plattform bereit, über die Sender einem
          Zusteller ein kostenloses Danke oder ein freiwilliges Trinkgeld
          zukommen lassen können. Lieferdank erbringt selbst keine Zustellleistung und ist
          nicht Vertragspartner des Transportvertrags.
        </p>

        <h2>3. Freiwilligkeit</h2>
        <p>
          Ein Danke ist stets kostenlos. Ein Trinkgeld ist freiwillig und niemals Voraussetzung
          für eine Zustellung. Zusteller dürfen Trinkgeld nicht einfordern.
        </p>

        <h2>4. Beträge und Gebühren</h2>
        <p>
          Der Sender zahlt exakt den ausgewählten Betrag. Es werden keine zusätzlichen Gebühren
          aufgeschlagen. Vom ausgewählten Betrag werden Zahlungs- und Plattformkosten abgezogen.
        </p>
        <p>
          Lieferdank erhält je nach Trinkgeldbetrag 0,50 € (2 €), 0,60 € (3 €) oder 1,00 € (5 €)
          als Application Fee. Stripe zieht seine Zahlungs- und gegebenenfalls Auszahlungskosten
          separat vom Stripe-Konto des Zustellers ab. Der tatsächliche Auszahlungsbetrag ist daher geringer.
        </p>

        <h2>5. Auszahlung</h2>
        <p>
          Trinkgelder werden direkt auf dem verbundenen Stripe-Konto des Zustellers verarbeitet.
          Stripe verwaltet dieses Konto und dessen reguläre Auszahlungen. Voraussetzung ist
          ein für Zahlungen und Auszahlungen freigeschaltetes Stripe-Konto.
        </p>

        <h2>6. Verifizierung und Sperrung</h2>
        <p>
          Stripe prüft die für Zahlungsannahme und Auszahlung erforderlichen Kontoinformationen.
          Ein optionales Lieferdank-Abzeichen für die Zustellertätigkeit ist davon getrennt.
          Bei begründetem Verdacht auf
          Missbrauch, falsche Angaben oder betrügerische Zahlungen kann Lieferdank Konten
          sperren, Codes neu vergeben und die Annahme neuer Trinkgelder unterbinden.
        </p>

        <h2 id="rueckerstattungen" className="scroll-mt-24">7. Rückerstattungen</h2>
        <p>
          Ein Trinkgeld ist eine freiwillige Zuwendung. Bei einer irrtümlichen oder betrügerischen
          Zahlung wende dich bitte unverzüglich an{" "}
          <a href="mailto:info@lieferdank.de">info@lieferdank.de</a>. Wir prüfen den konkreten
          Erstattungsfall. Die Behandlung von Rückbuchungen richtet sich zusätzlich nach den
          Bedingungen des Zahlungsdienstleisters.
        </p>

        <h2>8. Pflichten der Zusteller</h2>
        <ul>
          <li>Angaben zur Person müssen zutreffen.</li>
          <li>
            Die Regeln des jeweiligen Arbeitgebers bzw. Auftraggebers sind eigenverantwortlich
            zu beachten.
          </li>
          <li>Kunden dürfen nicht aktiv um Trinkgeld gebeten werden.</li>
          <li>
            Steuerliche und sozialversicherungsrechtliche Pflichten aus erhaltenen Trinkgeldern
            liegen beim Zusteller.
          </li>
        </ul>

        <h2>9. Keine Bewertungen</h2>
        <p>
          Über Lieferdank können ausschließlich positive Rückmeldungen gesendet werden. Es gibt
          keine Bewertungen, Ranglisten oder Beschwerdefunktionen.
        </p>

        <h2>10. Haftung</h2>
        <p>[Haftungsregelung durch Rechtsberatung ergänzen.]</p>

        <h2>11. Änderungen und Kündigung</h2>
        <p>
          Zusteller können ihr Lieferdank-Konto löschen. Bereits eingegangene Zahlungen,
          Erstattungen und Auszahlungen bleiben bei Stripe zu klären und unterliegen
          dessen Kontobedingungen. Änderungen dieser Bedingungen werden rechtzeitig angekündigt.
        </p>

        <h2>12. Schlussbestimmungen</h2>
        <p>Es gilt deutsches Recht. [Gerichtsstand durch Rechtsberatung ergänzen.]</p>
      </Prose>
    </>
  );
}
