import Link from "next/link";
import { getDb } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { Heart } from "@/components/icons";
import { Avatar } from "@/components/avatar";
import { getSession } from "@/server/session";
import { findDriverByCode, toPublicDriver } from "@/server/services/drivers";
import { paymentOutcome } from "@/server/services/thanks";
import { isFavorite } from "@/server/services/favorites";
import { MessageForm } from "./message-form";
import { SaveDriver } from "./save-driver";
import { OptionalTip } from "./optional-tip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Danke!", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function SuccessPage({ params, searchParams }: Props) {
  const { code } = await params;
  const query = await searchParams;

  const found = await findDriverByCode(code);
  const driver = found?.user ? toPublicDriver(found.driver, found.user) : null;
  const name = driver?.name ?? "Dein Lieferant";

  let thankYouId: string | null = null;
  let tipCents: number | null = null;
  let paymentPending = false;
  let paymentProblem = false;
  const freeThanks = Boolean(query.danke && !query.zahlung);

  if (query.zahlung && found) {
    const outcome = await paymentOutcome(query.zahlung, found.driver.id);
    if (outcome?.status === "succeeded") {
      tipCents = outcome.grossCents;
      thankYouId = outcome.thankYouId;
    } else if (outcome?.status === "pending") {
      paymentPending = true;
    } else {
      paymentProblem = true;
    }
  } else if (query.danke && found) {
    const thankYou = await getDb().thankYous.get(query.danke);
    if (thankYou?.driverId === found.driver.id) thankYouId = thankYou.id;
  }

  const session = await getSession();
  const saved = found && session?.customer ? await isFavorite(session.user.id, found.driver.id) : false;
  // Speichern ergibt nur für Kunden oder Besucher ohne Konto Sinn.
  const canSave = Boolean(driver) && (!session || Boolean(session.customer));

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-coral-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-10 pb-10">
        <header className="flex flex-col items-center text-center">
          <div className="relative">
            {driver ? (
              <Avatar name={driver.name} initials={driver.initials} photoUrl={driver.photoUrl} size="lg" />
            ) : (
              <span className="grid h-20 w-20 place-items-center rounded-full bg-coral-50" />
            )}
            <span className="absolute -right-1 -bottom-1 grid h-9 w-9 place-items-center rounded-full bg-coral text-white ring-4 ring-white">
              <Heart className="h-4 w-4" />
            </span>
          </div>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-brand-900">
            {freeThanks && thankYouId && query.bereits !== "1" ? "Danke! Deine Wertschätzung wurde übermittelt." : "Danke!"}
          </h1>
          <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink-soft">
            {paymentProblem ? (
              <>Diese Zahlung konnte noch nicht bestätigt werden. Bitte prüfe deinen Zahlungsstatus oder wende dich an den Support.</>
            ) : paymentPending ? (
              <>
                Deine Zahlung wird gerade bestätigt. Sobald sie durch ist, sieht{" "}
                <span className="font-semibold text-ink">{name}</span> dein Dankeschön.
              </>
            ) : tipCents ? (
              <>
                <span className="font-semibold text-ink">{name}</span> hat deine Wertschätzung
                erhalten. Deine Zahlung über {formatEuro(tipCents)} war erfolgreich.
              </>
            ) : freeThanks && query.bereits === "1" && thankYouId ? (
              <>Du hast {name} heute bereits Danke gesagt.</>
            ) : (
              <>
                <span className="font-semibold text-ink">{name}</span> hat deine Wertschätzung
                erhalten.
              </>
            )}
          </p>
        </header>

        {freeThanks && thankYouId && driver && <OptionalTip code={driver.code} tipReady={driver.tipReady} />}
        {thankYouId && <MessageForm thankYouId={thankYouId} />}

        {/* Erst nach dem Danke, dezent und nie Voraussetzung für irgendetwas. */}
        {canSave && driver && <SaveDriver code={driver.code} name={driver.name} alreadySaved={saved} loggedIn={Boolean(session)} />}

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
