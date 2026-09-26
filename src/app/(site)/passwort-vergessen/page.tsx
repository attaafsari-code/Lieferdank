import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetRequestForm } from "./reset-request-form";

export const metadata = {
  title: "Passwort vergessen",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Passwort vergessen?"
      lead="Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst."
      footer={
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Zurück zur Anmeldung
        </Link>
      }
    >
      <ResetRequestForm />
    </AuthShell>
  );
}
