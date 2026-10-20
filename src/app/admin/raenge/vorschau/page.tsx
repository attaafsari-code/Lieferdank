import Link from "next/link";
import { requireAdmin } from "@/server/guards";
import { qrSvg } from "@/server/qr";
import { cardBackgroundColor, CARD_LAYOUTS } from "@/lib/card/design";
import { renderCardSvg } from "@/lib/card/svg";
import { RANKS, rankProgress, type RankId } from "@/lib/ranks";
import { RankJourney } from "@/components/ranks";
import { previewSelection, type PreviewQuery } from "./selection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rangvorschau · Admin", robots: { index: false, follow: false } };

function href(selection: { rank: RankId; layout: string; color: string; showBadge: boolean }) {
  const params = new URLSearchParams({ rang: selection.rank, layout: selection.layout, farbe: selection.color, abzeichen: selection.showBadge ? "an" : "aus" });
  return `/admin/raenge/vorschau?${params}`;
}

export default async function AdminRankPreview({ searchParams }: { searchParams: Promise<PreviewQuery> }) {
  await requireAdmin();
  const { rank, layout, color, showBadge, unlockedColors } = previewSelection(await searchParams);
  const previewQr = await qrSvg("https://lieferdank.de/");
  const card = renderCardSvg({ layout, color, rank: rank.id, showRankBadge: showBadge, headline: "Danke für deine Wertschätzung ❤",
    publicName: "Vorschau", providerLabel: null, code: "LD-VORSCHAU", qrSvg: previewQr, avatar: { href: null, initials: "V" }, idPrefix: "rank-preview" });
  const progress = rankProgress(rank.threshold);
  const link = (next: Partial<{ rank: RankId; layout: string; color: string; showBadge: boolean }>) => href({ rank: rank.id, layout, color, showBadge, ...next });

  return <div className="space-y-7">
    <header><Link href="/admin/raenge" className="text-sm font-semibold text-brand">← Ränge & Rewards</Link>
      <h1 className="mt-2 text-3xl font-extrabold text-brand-900">Isolierte Rangvorschau</h1>
      <p className="mt-2 text-sm text-ink-soft">Simulation ohne Nutzerkonto, Danke-Einträge oder Reward-Ausgabe. Der Vorschau-QR führt zur LieferDank-Startseite.</p>
    </header>
    <nav aria-label="Rang auswählen" className="flex flex-wrap gap-2">{RANKS.map(item => <Link key={item.id} href={link({ rank: item.id, color: "blue" })} aria-current={item.id === rank.id ? "true" : undefined} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${item.id === rank.id ? "border-brand bg-brand-50 text-brand" : "border-line bg-white text-ink-soft"}`}>{item.label}</Link>)}</nav>
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <section className="space-y-5"><h2 className="text-xl font-bold text-brand-900">QR-Karte · {rank.label}</h2>
        <nav aria-label="Kartenlayout" className="flex flex-wrap gap-2">{CARD_LAYOUTS.map(item => <Link key={item.id} href={link({ layout: item.id })} aria-current={item.id === layout ? "true" : undefined} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${item.id === layout ? "border-brand bg-brand-50 text-brand" : "border-line bg-white text-ink-soft"}`}>{item.label}</Link>)}</nav>
        <nav aria-label="Rangabzeichen auf der Karte" className="flex gap-2">{[true, false].map(value => <Link key={String(value)} href={link({ showBadge: value })} aria-current={value === showBadge ? "true" : undefined} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${value === showBadge ? "border-brand bg-brand-50 text-brand" : "border-line bg-white text-ink-soft"}`}>Abzeichen {value ? "an" : "aus"}</Link>)}</nav>
        <div className="overflow-hidden rounded-2xl border border-line bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: card }} />
        <h3 className="font-bold text-brand-900">Freigeschaltete Rangfarben</h3>
        {unlockedColors.length ? <nav aria-label="Rangfarbe" className="flex flex-wrap gap-2">{unlockedColors.map(item => <Link key={item.id} href={link({ color: item.id })} aria-current={item.id === color ? "true" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm ${item.id === color ? "border-brand bg-brand-50" : "border-line bg-white"}`}><span aria-hidden className="h-5 w-5 rounded-full border border-line" style={{ background: cardBackgroundColor(layout, item.id) }} />{item.label}</Link>)}</nav> : <p className="text-sm text-ink-soft">Für Start ist noch keine Rangfarbe freigeschaltet.</p>}
      </section>
      <section className="space-y-4"><h2 className="text-xl font-bold text-brand-900">Öffentliches Rangprofil · Simulation</h2>
        <div className="rounded-3xl border border-line bg-white p-5"><p className="text-2xl font-extrabold text-brand-900">Vorschau</p><p className="text-sm text-ink-soft">LieferDank · simuliertes Profil</p></div>
        <RankJourney progress={progress} />
      </section>
    </div>
  </div>;
}
