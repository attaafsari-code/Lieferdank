import { PageHeader, Prose } from "@/components/page-shell";
import { CancellationForm } from "@/components/legal-forms";

export const metadata = { title: "Verträge hier kündigen", robots: { index: false, follow: true } };

/** Bestätigungsseite der Kündigungsschaltfläche nach § 312k BGB. */
export default function CancellationPage() {
  return (
    <>
      <PageHeader title="Verträge hier kündigen" lead="Kündige dein Lieferdank-Konto oder nur die Trinkgeld-Funktion – ohne Anmeldung." />
      <Prose>
        <p>
          Lieferdank-Verträge haben keine Mindestlaufzeit und keine Kündigungsfrist. Nach dem Absenden bekommst du sofort
          eine Bestätigung per E-Mail. Ein angemeldetes Konto kannst du auch direkt im Profil löschen.
        </p>
        <div className="mt-8 rounded-3xl border border-line bg-white p-6 shadow-xs">
          <CancellationForm />
        </div>
      </Prose>
    </>
  );
}
