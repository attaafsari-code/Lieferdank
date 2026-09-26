import { PageHeader, Prose } from "@/components/page-shell";
import { DraftNotice } from "@/components/legal-notice";
import { formatEuro } from "@/lib/format";
import { PLATFORM_GROSS_FEE_CENTS } from "@/lib/money";

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

        <h2>2. Leistung von Lieferdank</h2>
        <p>
          Lieferdank stellt eine technische Plattform bereit, über die Sender einem
          verifizierten Zusteller ein kostenloses Danke oder ein freiwilliges Trinkgeld
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
          aufgeschlagen. Von jeder Trinkgeldzahlung behält Lieferdank{" "}
          {formatEuro(PLATFORM_GROSS_FEE_CENTS)} ein; dieser Anteil deckt Zahlungsabwicklung,
          Betrieb, Support und Betrugsprävention. Der verbleibende Betrag wird dem Zusteller
          gutgeschrieben.
        </p>

        <h2>5. Auszahlung</h2>
        <p>
          Gutschriften werden als Guthaben gesammelt und gebündelt ausgezahlt. Voraussetzung
          sind eine abgeschlossene Verifizierung und ein eingerichtetes Auszahlungskonto beim
          Zahlungsdienstleister. Lieferdank verwahrt keine Kundengelder auf eigenen
          Geschäftskonten.
        </p>

        <h2>6. Verifizierung und Sperrung</h2>
        <p>
          Lieferdank prüft Identität und Zustellertätigkeit. Bei begründetem Verdacht auf
          Missbrauch, falsche Angaben oder betrügerische Zahlungen kann Lieferdank Konten
          sperren, Codes neu vergeben und Auszahlungen zurückhalten.
        </p>

        <h2>7. Rückerstattungen</h2>
        <p>
          Ein Trinkgeld ist eine freiwillige Zuwendung. Bei irrtümlichen oder betrügerischen
          Zahlungen wende dich bitte innerhalb von [X] Tagen an [kontakt@lieferdank.de]. Die
          Behandlung von Rückbuchungen richtet sich zusätzlich nach den Bedingungen des
          Zahlungsdienstleisters.
        </p>

        <h2>8. Pflichten der Zusteller</h2>
        <ul>
          <li>Angaben zur Person und zum Zustelldienst müssen zutreffen.</li>
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
          Zusteller können ihr Konto jederzeit löschen. Vorhandenes Guthaben wird vor der
          Löschung ausgezahlt. Änderungen dieser Bedingungen werden rechtzeitig angekündigt.
        </p>

        <h2>12. Schlussbestimmungen</h2>
        <p>Es gilt deutsches Recht. [Gerichtsstand durch Rechtsberatung ergänzen.]</p>
      </Prose>
    </>
  );
}
