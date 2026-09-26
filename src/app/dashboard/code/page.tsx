import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { qrPngDataUrl, qrSvg, thankYouUrl } from "@/lib/qr";
import { BaseUrlNotice } from "@/components/base-url-notice";
import { providerLabel } from "@/lib/providers";
import { CopyButton } from "@/components/copy-button";
import { PageTitle, SectionTitle } from "@/components/dashboard-ui";
import { ArrowRight, Check, Download } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mein Danke-Code" };

const TIPS = [
  "Trag die Karte sichtbar, zum Beispiel am Schlüsselband oder an der Scannertasche.",
  "Bitte niemanden aktiv um Trinkgeld. Der Kunde entscheidet freiwillig.",
  "Beachte die Regeln deines Arbeitgebers bzw. Auftraggebers.",
];

export default async function CodePage() {
  const session = await getSession();
  if (!session?.driver) redirect("/login");

  const driver = session.driver;
  const url = thankYouUrl(driver.code);
  const [svg, png] = await Promise.all([qrSvg(url), qrPngDataUrl(url)]);
  const svgDownload = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return (
    <div className="space-y-12">
      <PageTitle
        title="Dein Danke-Code"
        lead="Kunden scannen diesen Code und können dir Danke sagen. Keine App nötig."
      />

      <BaseUrlNotice url={url} context="code" />

      <div className="mx-auto w-full max-w-sm rounded-3xl border border-line bg-white p-8 text-center shadow-md">
        <div
          className="mx-auto w-56 [&>svg]:h-full [&>svg]:w-full"
          role="img"
          aria-label={`QR-Code für ${driver.code}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <p className="mt-7 font-mono text-2xl font-extrabold tracking-wider text-brand-900">
          {driver.code}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {driver.displayName}
          {driver.providerId && ` · unterwegs für ${providerLabel(driver.providerId)}`}
        </p>

        <div className="mt-7 space-y-2.5">
          <Link href="/dashboard/karte" className="btn btn-primary w-full">
            Karte ansehen &amp; drucken
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="grid grid-cols-2 gap-2.5">
            <a href={png} download={`lieferdank-${driver.code}.png`} className="btn btn-ghost btn-sm">
              <Download className="h-4 w-4" />
              PNG
            </a>
            <a
              href={svgDownload}
              download={`lieferdank-${driver.code}.svg`}
              className="btn btn-ghost btn-sm"
            >
              <Download className="h-4 w-4" />
              SVG
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          SVG für den Druck, PNG fürs Handy oder für Nachrichten.
        </p>
      </div>

      <section>
        <SectionTitle>Dein Link</SectionTitle>
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-xs sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-canvas px-3.5 py-2.5 text-sm text-ink">
            {url}
          </code>
          <CopyButton value={url} label="Link kopieren" />
        </div>
        <p className="hint">
          Du kannst den Link auch direkt teilen.{" "}
          <Link
            href={`/danke/${driver.code}?vorschau=1`}
            className="font-semibold text-brand underline underline-offset-2"
          >
            Vorschau ansehen
          </Link>{" "}
          – Vorschauen zählen nicht als Scan.
        </p>
      </section>

      <section>
        <SectionTitle>So nutzt du den Code</SectionTitle>
        <ul className="space-y-3 rounded-2xl border border-line bg-white p-6 shadow-xs">
          {TIPS.map((tip) => (
            <li key={tip} className="flex gap-3 leading-relaxed text-ink">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
                <Check className="h-3 w-3" />
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
