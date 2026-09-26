import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden", robots: { index: false, follow: true } };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.user.role === "admin" ? "/admin" : "/dashboard");

  return (
    <AuthShell
      title="Willkommen zurück"
      lead="Melde dich mit deinem Lieferdank-Konto an."
      footer={
        <>
          Noch kein Konto?{" "}
          <Link href="/register" className="font-semibold text-brand hover:underline">
            Kostenlos registrieren
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
