import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { newsletterEnabled } from "@/server/services/newsletter";
import { ConfirmNewsletterForm } from "./confirm-newsletter-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Newsletter bestätigen", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/** Double-Opt-in: bestätigt erst per Klick, nicht schon beim Öffnen (Link-Scanner). */
export default async function ConfirmNewsletterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!newsletterEnabled()) notFound();
  const token = (await searchParams).token ?? "";
  return (
    <AuthShell title="Newsletter bestätigen" lead="Ein Klick genügt. Abmelden kannst du dich jederzeit in deinen Einstellungen.">
      <ConfirmNewsletterForm token={token} />
    </AuthShell>
  );
}
