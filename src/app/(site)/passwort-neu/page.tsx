import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { NewPasswordForm } from "./new-password-form";

export const dynamic = "force-dynamic";
// Der Link enthält ein Token – es soll nie per Referer an andere Seiten gehen.
export const metadata = { title: "Neues Passwort", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const token = (await searchParams).token ?? "";

  if (!token) {
    return (
      <AuthShell
        title="Link unvollständig"
        lead="Dieser Link enthält kein gültiges Token. Fordere bitte einen neuen an."
        footer={
          <Link href="/passwort-vergessen" className="font-semibold text-brand hover:underline">
            Neuen Link anfordern
          </Link>
        }
      >
        <Link href="/passwort-vergessen" className="btn btn-primary w-full">
          Neuen Link anfordern
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Neues Passwort setzen"
      lead="Danach bist du automatisch angemeldet. Alle anderen Geräte werden abgemeldet."
      footer={
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Zurück zur Anmeldung
        </Link>
      }
    >
      <NewPasswordForm token={token} />
    </AuthShell>
  );
}
