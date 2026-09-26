import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/db";
import { newId, normalizeCode } from "@/lib/id";
import { providerLabel } from "@/lib/providers";
import { PLATFORM_GROSS_FEE_CENTS } from "@/lib/money";
import { LogoMark } from "@/components/logo";
import { ThankYouScreen } from "./thank-you-screen";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const driver = await getStore().getDriverByCode(normalizeCode(code));
  return {
    title: driver ? `Danke an ${driver.displayName}` : "Danke sagen",
    description: "Sag deinem Zusteller Danke – kostenlos, ohne App.",
    robots: { index: false, follow: false },
  };
}

export default async function ThankYouPage({ params, searchParams }: Params) {
  const { code } = await params;
  const query = await searchParams;
  const store = getStore();
  const driver = await store.getDriverByCode(normalizeCode(code));

  if (!driver) return <UnknownCode />;

  const user = await store.getUserById(driver.userId);
  if (!driver.active || !user || user.blockedAt) return <InactiveCode />;

  // Scan zaehlen -- Basis fuer die Scan-to-Payment Conversion (§80).
  // Die Eigenvorschau des Zustellers zaehlt nicht mit.
  if (query.vorschau !== "1") {
    await store.createScan(driver.id, newId(), new Date().toISOString());
  }

  return (
    <ThankYouScreen
      code={driver.code}
      displayName={driver.displayName}
      verified={driver.verification === "verified"}
      providerLabel={providerLabel(driver.providerId)}
      providerVerified={driver.providerVerified}
      platformFeeCents={PLATFORM_GROSS_FEE_CENTS}
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
      text="Bitte prüfe, ob der QR-Code vollständig gescannt wurde. Falls der Code auf einer Karte steht, kann er auch abgelaufen sein."
    />
  );
}

function InactiveCode() {
  return (
    <Shell
      title="Dieser Danke-Code ist gerade pausiert"
      text="Der Zusteller kann aktuell kein Danke empfangen. Vielleicht später noch einmal versuchen."
    />
  );
}
