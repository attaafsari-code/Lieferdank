import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { qrSvg, thankYouUrl } from "@/lib/qr";
import { BaseUrlNotice } from "@/components/base-url-notice";
import { providerLabel } from "@/lib/providers";
import { LieferdankCard } from "@/components/lieferdank-card";
import { PrintButton } from "@/components/print-button";
import { Check } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lieferdank-Karte" };

/**
 * 8 Karten pro A4-Seite (2 Spalten × 4 Zeilen).
 * Rechnung: 2 × 85,6 mm + 4 mm = 175,2 mm breit, 4 × 54 mm + 3 × 4 mm = 228 mm hoch.
 * Bei 10 mm Seitenrand bleiben 190 × 277 mm nutzbar – passt mit Reserve.
 */
const CARDS_PER_SHEET = 8;

const PRINT_TIPS = [
  "Drucke auf festerem Papier – 200 g/m² fühlt sich wie eine echte Karte an.",
  "Im Druckdialog „Tatsächliche Größe“ bzw. 100 % wählen, nicht „An Seite anpassen“.",
  "Hintergrundgrafiken aktivieren, damit der QR-Code sauber schwarz bleibt.",
];

export default async function CardPage() {
  const session = await getSession();
  if (!session?.driver) redirect("/login");

  const driver = session.driver;
  const url = thankYouUrl(driver.code);
  const svg = await qrSvg(url);
  const provider = providerLabel(driver.providerId);

  const card = (
    <LieferdankCard
      qrSvg={svg}
      displayName={driver.displayName}
      providerLabel={provider}
      code={driver.code}
    />
  );

  return (
    <div>
      <div className="no-print">
        <Link
          href="/dashboard/code"
          className="text-sm font-semibold text-brand hover:underline"
        >
          ← Zurück zum Code
        </Link>

        <h1 className="mt-4 text-[1.75rem] font-extrabold tracking-tight text-brand-900">
          Deine Lieferdank-Karte
        </h1>
        <p className="mt-1.5 max-w-xl leading-relaxed text-ink-soft">
          Format 85,6 × 54 mm – wie eine EC-Karte. Eine A4-Seite ergibt{" "}
          {CARDS_PER_SHEET} Karten zum Ausschneiden.
        </p>

        <div className="mt-6">
          <BaseUrlNotice url={url} context="print" />
        </div>

        {/* Einzelvorschau in realer Größe */}
        <div className="mt-9 overflow-x-auto pb-2">
          <div className="w-fit rounded-3xl bg-gradient-to-br from-brand-50 to-coral-50 p-10">
            <div className="[&>div]:shadow-lg">{card}</div>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <PrintButton label={`${CARDS_PER_SHEET} Karten drucken`} />
          <p className="text-sm text-ink-soft">
            Im Druckdialog „Als PDF sichern“ wählen, um eine Datei für den Copyshop zu
            erhalten.
          </p>
        </div>

        <ul className="mt-8 space-y-2.5 rounded-2xl border border-line bg-white p-6 shadow-xs">
          {PRINT_TIPS.map((tip) => (
            <li key={tip} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
                <Check className="h-3 w-3" />
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Druckbogen: erscheint nur im Ausdruck. */}
      <div
        className="print-sheet hidden print:grid"
        style={{
          gridTemplateColumns: "repeat(2, 85.6mm)",
          justifyContent: "start",
          gap: "4mm",
        }}
      >
        {Array.from({ length: CARDS_PER_SHEET }, (_, index) => (
          <div key={index}>{card}</div>
        ))}
      </div>
    </div>
  );
}
