import Link from "next/link";
import { PageHeader, Prose } from "@/components/page-shell";
import { WithdrawalForm } from "@/components/legal-forms";
import { TIPPING_SERVICE_NAME } from "@/lib/legal-content";

export const metadata = { title: "Vertrag widerrufen", robots: { index: false, follow: true } };

/** Elektronische Widerrufsfunktion nach § 356a BGB. */
export default function WithdrawalPage() {
  return (
    <>
      <PageHeader title="Vertrag widerrufen" lead={`Widerruf der Lieferdank-${TIPPING_SERVICE_NAME} innerhalb von 14 Tagen nach Vertragsabschluss.`} />
      <Prose>
        <p>
          Gib deinen Namen, dein Konto und eine E-Mail-Adresse für die Eingangsbestätigung an und klicke auf
          „Widerruf bestätigen“. Einzelheiten stehen in der{" "}
          <Link href="/legal/agb#widerruf">Widerrufsbelehrung</Link>.
        </p>
        <div className="mt-8 rounded-3xl border border-line bg-white p-6 shadow-xs">
          <WithdrawalForm />
        </div>
      </Prose>
    </>
  );
}
