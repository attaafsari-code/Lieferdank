import { PageHeader, Prose } from "@/components/page-shell";

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
          Atta Afsari Gargari
          <br />
          Dürkheimerstraße 2
          <br />
          76187 Karlsruhe
          <br />
          Deutschland
        </p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href="mailto:info@lieferdank.de">info@lieferdank.de</a>
        </p>

        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>Atta Afsari Gargari, Anschrift wie oben</p>

        <h2>Verbraucherstreitbeilegung</h2>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>

        <h2>Hinweis zu Marken Dritter</h2>
        <p>
          Marken Dritter sind Eigentum der jeweiligen Unternehmen. Lieferdank steht in keiner
          Verbindung zu Paketdiensten und verwendet deren Logos nicht.
        </p>
      </Prose>
    </>
  );
}
