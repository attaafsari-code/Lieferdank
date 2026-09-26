import type { Metadata } from "next";
import Link from "next/link";
import { findDriverByCode, toPublicDriver } from "@/server/services/drivers";
import { recordScan } from "@/server/services/thanks";
import { getPaymentProvider } from "@/server/payments";
import { PLATFORM_GROSS_FEE_CENTS } from "@/lib/money";
import { LogoMark } from "@/components/logo";
import { ThankYouScreen } from "./thank-you-screen";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const found = await findDriverByCode(code);
  const name = found?.user ? toPublicDriver(found.driver, found.user).name : null;
  return {
    title: name ? `Sag ${name} Danke` : "Danke sagen",
    description: "Sag deinem Zusteller Danke – kostenlos, ohne App, in wenigen Sekunden.",
    robots: { index: false, follow: false },
  };
}

export default async function ThankYouPage({ params, searchParams }: Params) {
  const { code } = await params;
  const query = await searchParams;
  const found = await findDriverByCode(code);

  if (!found) return <UnknownCode />;
  const { driver, user } = found;
  if (!driver.active || !user || user.blockedAt) return <InactiveCode />;

  // Scan zählen – Basis der Scan-to-Payment-Conversion. Die Eigenvorschau zählt nicht.
  if (query.vorschau !== "1") await recordScan(driver.id);

  return (
    <ThankYouScreen
      driver={toPublicDriver(driver, user)}
      platformFeeCents={PLATFORM_GROSS_FEE_CENTS}
      paymentMethods={getPaymentProvider().methodsLabel}
      cancelled={query.abgebrochen === "1"}
    />
  );
}

function Shell({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <LogoMark className="h-11 w-11" />
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-brand-900">{title}</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">{text}</p>
      <Link href="/" className="btn btn-ghost mt-8">
        Was ist Lieferdank?
      </Link>
    </div>
  );
}

function UnknownCode() {
  return (
    <Shell
      title="Diesen Danke-Code gibt es nicht"
      text="Bitte prüfe, ob der QR-Code vollständig gescannt wurde. Steht der Code auf einer Karte, kann er auch ersetzt worden sein."
    />
  );
}

function InactiveCode() {
  return (
    <Shell
      title="Dieser Danke-Code ist gerade pausiert"
      text="Der Lieferant kann aktuell kein Danke empfangen. Vielleicht später noch einmal versuchen."
    />
  );
}
