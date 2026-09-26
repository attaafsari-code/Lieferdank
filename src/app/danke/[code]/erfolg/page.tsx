import Link from "next/link";
import { getStore } from "@/lib/db";
import { normalizeCode } from "@/lib/id";
import { formatEuro } from "@/lib/format";
import { Heart } from "@/components/icons";
import { MessageForm } from "./message-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Danke!", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function SuccessPage({ params, searchParams }: Props) {
  const { code } = await params;
  const query = await searchParams;
  const store = getStore();

  const driver = await store.getDriverByCode(normalizeCode(code));
  const displayName = driver?.displayName ?? "Dein Zusteller";

  let thankYouId: string | null = null;
  let tipAmountCents: number | null = null;
  let paymentPending = false;

  if (query.trinkgeld && driver) {
    const tip = await store.getTipById(query.trinkgeld);
    if (tip && tip.driverId === driver.id) {
      if (tip.paymentStatus === "succeeded") {
        tipAmountCents = tip.grossCents;
        const thankYous = await store.listThankYousByDriver(driver.id);
        thankYouId = thankYous.find((t) => t.tipId === tip.id)?.id ?? null;
      } else if (tip.paymentStatus === "pending") {
        paymentPending = true;
      }
    }
  } else if (query.danke && driver) {
    const thankYou = await store.getThankYouById(query.danke);
    if (thankYou && thankYou.driverId === driver.id) thankYouId = thankYou.id;
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-coral-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-12 pb-10">
        <header className="text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-coral-50 ring-8 ring-white">
            <Heart className="h-9 w-9 text-coral" />
          </span>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-brand-900">Danke!</h1>

          <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink-soft">
            {paymentPending ? (
              <>
                Deine Zahlung wird gerade bestätigt. Sobald sie durch ist, sieht{" "}
                <span className="font-semibold text-ink">{displayName}</span> dein
                Dankeschön. Du kannst diese Seite schließen.
              </>
            ) : tipAmountCents ? (
              <>
                <span className="font-semibold text-ink">{displayName}</span> hat deine
                Wertschätzung erhalten – {formatEuro(tipAmountCents)} Trinkgeld sind
                unterwegs.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">{displayName}</span> hat deine
                Wertschätzung erhalten.
              </>
            )}
          </p>
        </header>

        {thankYouId && <MessageForm thankYouId={thankYouId} />}

        <footer className="mt-auto pt-12 text-center">
          <p className="text-sm leading-relaxed text-ink-soft">
            Lieferdank macht es einfach, dem Menschen hinter der Lieferung Danke zu sagen.
          </p>
          <Link href="/" className="btn btn-ghost btn-sm mt-4">
            Mehr über Lieferdank
          </Link>
        </footer>
      </div>
    </div>
  );
}
