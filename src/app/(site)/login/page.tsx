import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { homePathFor } from "@/server/services/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden", robots: { index: false, follow: true } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (session) redirect(homePathFor(session.user));
  const query = await searchParams;

  return (
    <AuthShell
      title="Willkommen zurück"
      lead={query.merken ? "Melde dich an, um den Lieferanten zu speichern." : "Melde dich mit deinem Lieferdank-Konto an."}
      footer={
        <>
          Neu hier?{" "}
          <Link href="/register" className="font-semibold text-brand hover:underline">
            Als Lieferant starten
          </Link>
          <span className="mx-1.5 text-ink-faint">·</span>
          <Link
            href={query.merken ? `/konto/registrieren?merken=${encodeURIComponent(query.merken)}` : "/konto/registrieren"}
            className="font-semibold text-brand hover:underline"
          >
            Kundenkonto
          </Link>
        </>
      }
    >
      <LoginForm next={query.weiter} saveCode={query.merken} />
    </AuthShell>
  );
}
