import Link from "next/link";
import { requireDriver } from "@/server/guards";
import { cardContext } from "@/server/services/cards";
import { qrPngDataUrl, qrSvgWithQuietZone } from "@/server/qr";
import { BaseUrlNotice } from "@/components/base-url-notice";
import { CopyButton } from "@/components/copy-button";
import { PageTitle, SectionTitle } from "@/components/dashboard-ui";
import { ArrowRight, Check, Download } from "@/components/icons";
import { CardDesigner } from "./card-designer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Karte & QR-Code" };

const TIPS = [
  "Trag die Karte sichtbar – am Schlüsselband, an der Scannertasche oder auf der Ablage.",
  "Bitte niemanden aktiv um Trinkgeld. Der Kunde entscheidet freiwillig.",
  "Beachte die Regeln deines Arbeitgebers bzw. Auftraggebers.",
];

export default async function CardPage() {
  const { user, driver } = await requireDriver();
  const card = await cardContext(driver, user);
  const [qrPng, qrSvgDownload] = await Promise.all([qrPngDataUrl(card.url), qrSvgWithQuietZone(card.url)]);
  const svgHref = `data:image/svg+xml;base64,${Buffer.from(qrSvgDownload, "utf8").toString("base64")}`;

  return (
    <div className="space-y-14">
      <PageTitle
        title="Deine Karte"
        lead="Gestalte sie so, wie sie zu dir passt. Der QR-Code bleibt immer derselbe – auch wenn du Name, Text oder Foto änderst."
      />

      <BaseUrlNotice url={card.url} context="code" />

      <CardDesigner
        initial={{
          layout: card.design.layout,
          headline: card.design.headline,
          showPhoto: card.design.showPhoto,
          showProvider: card.design.showProvider,
        }}
        qrSvg={card.qr}
        publicName={card.publicName}
        initials={card.initials}
        providerLabel={card.providerLabel}
        photoUrl={card.photoUrl}
        code={card.code}
      />

      <section className="grid gap-6 rounded-3xl border border-line bg-white p-6 shadow-xs sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
        <div className="mx-auto w-40 rounded-2xl bg-white p-3 ring-1 ring-line sm:mx-0">
          <div
            className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            role="img"
            aria-label={`QR-Code für ${card.code}`}
            dangerouslySetInnerHTML={{ __html: card.qr }}
          />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-brand-900">Nur der QR-Code</h2>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">
            Zum Zeigen am Handy, für Aufkleber oder eigene Designs.
          </p>
          <p className="mt-3 font-mono text-lg font-extrabold tracking-wider text-brand-900">{card.code}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={qrPng} download={`lieferdank-qr-${card.code}.png`} className="btn btn-ghost btn-sm">
              <Download className="h-4 w-4" /> QR als PNG
            </a>
            <a href={svgHref} download={`lieferdank-qr-${card.code}.svg`} className="btn btn-ghost btn-sm">
              <Download className="h-4 w-4" /> QR als SVG
            </a>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Dein Link</SectionTitle>
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-xs sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-canvas px-3.5 py-2.5 text-sm text-ink">{card.url}</code>
          <CopyButton value={card.url} label="Link kopieren" />
        </div>
        <p className="hint">
          <Link href={`/danke/${card.code}?vorschau=1`} className="font-semibold text-brand underline underline-offset-2">
            So sieht deine Kundenseite aus
          </Link>{" "}
          – Vorschauen zählen nicht als Scan.
        </p>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl bg-brand-900 p-7 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold">Echte Plastikkarte</h2>
          <p className="mt-1 max-w-md text-[0.9375rem] leading-relaxed text-white/75">
            Robust, wasserfest, mit deinem Design. Wir schicken sie dir nach Hause.
          </p>
        </div>
        <Link href="/dashboard/karte/bestellen" className="btn btn-white shrink-0">
          Karte bestellen
          <ArrowRight className="h-4 w-4" />
        </Link>
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
