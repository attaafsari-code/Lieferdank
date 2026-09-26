import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { Check } from "@/components/icons";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Danke-Code erstellen",
  description:
    "Erstelle kostenlos dein Lieferdank-Profil und erhalte sofort deinen persönlichen Danke-Code.",
  alternates: { canonical: "/register" },
};

const POINTS = [
  "Sofort einsatzbereit – ohne Freischaltung",
  "Danke sagen ist für Kunden kostenlos",
  "Dein Code bleibt deiner, auch beim Jobwechsel",
];

export default async function RegisterPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <AuthShell
      title="Hol dir deinen Danke-Code"
      lead="Kostenlos für Zusteller. In unter zwei Minuten eingerichtet."
      footer={
        <>
          Schon registriert?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Anmelden
          </Link>
        </>
      }
    >
      <ul className="mb-7 space-y-2.5 border-b border-line pb-7">
        {POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-[0.9375rem] text-ink">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
              <Check className="h-3 w-3" />
            </span>
            {point}
          </li>
        ))}
      </ul>

      <RegisterForm />
    </AuthShell>
  );
}
