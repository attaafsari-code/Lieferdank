import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { homePathFor } from "@/server/services/auth";
import { AuthShell } from "@/components/auth-shell";
import { CustomerRegisterForm } from "./customer-register-form";

export const metadata = { title: "Kundenkonto erstellen", robots: { index: false, follow: true } };

export default async function CustomerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (session) redirect(homePathFor(session.user));
  const { merken } = await searchParams;

  return (
    <AuthShell
      title="Deine Lieblingslieferanten"
      lead="Freiwillig: Mit einem Konto speicherst du Lieferanten und findest sie jederzeit wieder. Zum Danke sagen und Bezahlen brauchst du nie eins."
      footer={
        <>
          Schon ein Konto?{" "}
          <Link href={merken ? `/login?merken=${encodeURIComponent(merken)}` : "/login"} className="font-semibold text-brand hover:underline">
            Anmelden
          </Link>
        </>
      }
    >
      <CustomerRegisterForm saveCode={merken} />
    </AuthShell>
  );
}
