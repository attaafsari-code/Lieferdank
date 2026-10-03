import { PageHeader, Prose } from "@/components/page-shell";
import { ContactForms } from "@/components/legal-forms";
import { OPERATOR } from "@/lib/legal-content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kontakt", alternates: { canonical: "/kontakt" } };

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const topic = query.anliegen === "meldung" ? "meldung" : "anfrage";
  const location = query.code ? `Danke-Seite ${query.code.slice(0, 20)}` : query.ort?.slice(0, 200);

  return (
    <>
      <PageHeader title="Kontakt" lead="Schreib uns über dieses Formular oder per E-Mail. Wir antworten per E-Mail." />
      <Prose>
        <p>
          E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Wir kommunizieren auf Deutsch und Englisch.
          Diese Kontaktwege sind auch die zentrale Kontaktstelle für Behörden und Nutzer nach Art. 11 und 12 des
          Gesetzes über digitale Dienste (DSA).
        </p>
        <p>
          Hältst du einen Inhalt auf Lieferdank für rechtswidrig – etwa ein Profil, ein Foto oder eine Nachricht –, wähle
          „Rechtswidrigen Inhalt melden“. Wir bestätigen den Eingang, prüfen die Meldung und teilen dir unsere Entscheidung mit.
        </p>
        <div className="not-prose mt-8 rounded-3xl border border-line bg-white p-6 shadow-xs">
          <ContactForms initialTopic={topic} location={location} />
        </div>
      </Prose>
    </>
  );
}
