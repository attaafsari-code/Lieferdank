import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ConfirmEmailForm } from "./confirm-email-form";

export const dynamic = "force-dynamic";
// Der Link enthält ein Token – es soll nie per Referer an andere Seiten gehen.
export const metadata = { title: "E-Mail bestätigen", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const token = (await searchParams).token ?? "";

  if (!token) {
    return (
      <AuthShell
        title="Link unvollständig"
        lead="Dieser Link enthält kein gültiges Token. Melde dich an und fordere im Dashboard bzw. Kundenkonto einen neuen an."
      >
        <Link href="/login" className="btn btn-primary w-full">
          Zur Anmeldung
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="E-Mail-Adresse bestätigen" lead="Ein Klick genügt. Danach kannst du alle Funktionen deines Kontos nutzen.">
      <ConfirmEmailForm token={token} />
    </AuthShell>
  );
}
