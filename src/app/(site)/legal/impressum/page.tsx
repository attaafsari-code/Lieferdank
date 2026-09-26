import { PageHeader, Prose } from "@/components/page-shell";
import { DraftNotice } from "@/components/legal-notice";

export const metadata = {
  title: "Impressum",
  robots: { index: false, follow: true },
  alternates: { canonical: "/legal/impressum" },
};

export default function ImprintPage() {
  return (
    <>
      <PageHeader title="Impressum" />
      <Prose>
        <DraftNotice />

        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          [Firmenname]
          <br />
          [Straße und Hausnummer]
          <br />
          [PLZ Ort]
          <br />
          Deutschland
        </p>

        <h2>Vertreten durch</h2>
        <p>[Vor- und Nachname der vertretungsberechtigten Person]</p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: [kontakt@lieferdank.de]
          <br />
          Telefon: [Telefonnummer]
        </p>

        <h2>Registereintrag</h2>
        <p>
          [Registergericht, Registernummer – entfällt bei Einzelunternehmen ohne
          Handelsregistereintrag]
        </p>

        <h2>Umsatzsteuer-Identifikationsnummer</h2>
        <p>[USt-IdNr. gemäß § 27 a UStG, sofern vorhanden]</p>

        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>[Name, Anschrift]</p>

        <h2>Verbraucherstreitbeilegung</h2>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>

        <h2>Hinweis zu Marken Dritter</h2>
        <p>
          Genannte Zustelldienste und deren Marken sind Eigentum der jeweiligen Unternehmen.
          Lieferdank steht in keiner Verbindung zu diesen Unternehmen und verwendet deren
          Logos nicht. Angaben wie „unterwegs für DHL“ sind Selbstauskünfte der Zusteller.
        </p>
      </Prose>
    </>
  );
}
