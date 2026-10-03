import Link from "next/link";
import { PageHeader, Prose } from "@/components/page-shell";
import { OPERATOR } from "@/lib/legal-content";

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
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          {OPERATOR.name}
          <br />
          {OPERATOR.street}
          <br />
          {OPERATOR.city}
          <br />
          {OPERATOR.country}
        </p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
          {OPERATOR.phone && <><br />Telefon: {OPERATOR.phone}</>}
          <br />
          Kontaktformular: <Link href="/kontakt">lieferdank.de/kontakt</Link>
        </p>

        <h2>Zentrale Kontaktstelle nach Art. 11 und 12 DSA</h2>
        <p>
          Behörden, die EU-Kommission und Nutzer erreichen uns über die oben genannte E-Mail-Adresse und das
          Kontaktformular, auf Deutsch oder Englisch. Rechtswidrige Inhalte kannst du über{" "}
          <Link href="/kontakt?anliegen=meldung">„Rechtswidrigen Inhalt melden“</Link> melden.
        </p>

        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>{OPERATOR.name}, Anschrift wie oben</p>

        <h2>Verbraucherstreitbeilegung</h2>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>

        <h2>Hinweis zu Marken Dritter</h2>
        <p>
          Marken Dritter sind Eigentum der jeweiligen Unternehmen. Lieferdank steht in keiner Verbindung zu Paketdiensten
          und verwendet deren Logos nicht.
        </p>
      </Prose>
    </>
  );
}
