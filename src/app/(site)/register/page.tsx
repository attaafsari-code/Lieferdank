import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { homePathFor } from "@/server/services/auth";
import { AuthShell } from "@/components/auth-shell";
import { Check } from "@/components/icons";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Als Lieferant starten",
  description: "Erstelle kostenlos dein Lieferdank-Profil und erhalte sofort deinen persönlichen Danke-Code.",
  alternates: { canonical: "/register" },
};

const POINTS = [
  "Sofort einsatzbereit – ohne Freischaltung",
  "Du entscheidest, was Kunden von dir sehen",
  "Dein Code bleibt deiner, auch beim Jobwechsel",
];

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.user));

  return (
    <AuthShell
      title="Als Lieferant starten"
      lead="Kostenlos. In unter zwei Minuten hast du deinen persönlichen Danke-Code."
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
