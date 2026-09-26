import Link from "next/link";
import { requireDriver } from "@/server/guards";
import { renderDriverCard } from "@/server/services/cards";
import { thankYouUrl } from "@/server/qr";
import { BaseUrlNotice } from "@/components/base-url-notice";
import { PrintButton } from "@/components/print-button";
import { Check } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Karte drucken" };

/**
 * 8 Karten pro A4-Seite (2 × 4). Rechnung: 2 × 85,6 + 4 = 175,2 mm breit,
 * 4 × 54 + 3 × 4 = 228 mm hoch – bei 10 mm Rand passt das mit Reserve.
 */
const CARDS_PER_SHEET = 8;

const PRINT_TIPS = [
  "Im Druckdialog „Tatsächliche Größe“ bzw. 100 % wählen, nicht „An Seite anpassen“.",
  "Festeres Papier (ab 200 g/m²) fühlt sich wie eine echte Karte an.",
  "„Als PDF sichern“ ergibt eine Datei für den Copyshop.",
];

export default async function PrintPage() {
  const { user, driver } = await requireDriver();
  const cards = await Promise.all(
    Array.from({ length: CARDS_PER_SHEET }, (_, index) => renderDriverCard(driver, user, `print${index}`)),
  );

  return (
    <div>
      <div className="no-print space-y-6">
        <Link href="/dashboard/karte" className="text-sm font-semibold text-brand hover:underline">
          ← Zurück zur Karte
        </Link>
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight text-brand-900">Karten drucken</h1>
          <p className="mt-1.5 max-w-xl leading-relaxed text-ink-soft">
            {CARDS_PER_SHEET} Karten pro A4-Seite zum Ausschneiden, exakt im Scheckkartenformat.
          </p>
        </div>
        <BaseUrlNotice url={thankYouUrl(driver.code)} context="print" />
        <PrintButton label="Jetzt drucken" />
        <ul className="space-y-2.5 rounded-2xl border border-line bg-white p-6 shadow-xs">
          {PRINT_TIPS.map((tip) => (
            <li key={tip} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
                <Check className="h-3 w-3" />
              </span>
              {tip}
            </li>
          ))}
        </ul>
        <p className="eyebrow pt-4">Vorschau des Druckbogens</p>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
      <div
        className="print-sheet mt-4 grid w-fit bg-white p-2 print:mt-0 print:p-0"
        style={{ gridTemplateColumns: "repeat(2, 85.6mm)", gap: "4mm" }}
      >
        {cards.map((svg, index) => (
          <div key={index} style={{ width: "85.6mm", height: "54mm" }} dangerouslySetInnerHTML={{ __html: svg }} />
        ))}
      </div>
      </div>
    </div>
  );
}
