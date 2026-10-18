import { RANKS, RANK_EXPLANATION, REWARD_PREVIEW, rankBadgeMarkup, rankTier, type RankId, type RankProgress } from "@/lib/ranks";

export function RankBadge({ id, size = 48 }: { id: RankId; size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 60" width={size} height={size * 1.25} style={{ display: "block", flexShrink: 0, width: size, height: size * 1.25 }} role="img" aria-label={`${rankTier(id)?.label ?? ""} – LieferDank-Rang`} dangerouslySetInnerHTML={{ __html: rankBadgeMarkup(id) }} />;
}
export function RankSummary({ progress }: { progress: RankProgress }) {
  const p = progress;
  return <div className="space-y-4">
    <div className="flex items-center gap-4">{p.current ? <RankBadge id={p.current.id} /> : <span className="grid h-14 w-12 shrink-0 place-items-center rounded-2xl border border-line text-xl font-bold text-ink-faint">0</span>}
      <div><p className="text-xl font-extrabold text-brand-900">{p.current?.label ?? "Dein erstes Abzeichen wartet"}</p><p className="text-sm text-ink-soft">{p.count.toLocaleString("de-DE")} gültige Danke</p></div>
    </div>
    <p className="font-semibold text-ink">{p.maximum ? "Höchster Rang erreicht: Legende" : `Nächster Rang: ${p.next!.label} · ${p.target.toLocaleString("de-DE")} Danke`}</p>
    <progress className="block h-3 w-full" style={{ accentColor: p.current?.color ?? "#1a5ce0" }} aria-label="Fortschritt zum nächsten Rang" value={Math.min(p.count, p.target)} max={p.target} />
    <p className="flex flex-wrap justify-between gap-2 text-sm text-ink-soft"><span>{p.maximum ? `${p.count.toLocaleString("de-DE")} gültige Danke` : `${p.count.toLocaleString("de-DE")} von ${p.target.toLocaleString("de-DE")} Danke`} · {p.percent} %</span><span>{p.maximum ? "Alle Ränge erreicht" : `Noch ${p.remaining.toLocaleString("de-DE")} Danke`}</span></p>
  </div>;
}
export function RankJourney({ progress }: { progress: RankProgress }) {
  return <div className="space-y-6"><section className="rounded-3xl border border-line bg-white p-5 sm:p-7"><RankSummary progress={progress} /></section>
    <ol className="grid gap-3 sm:grid-cols-2">{RANKS.map(rank => {
      const reached = progress.count >= rank.threshold;
      return <li key={rank.id} className={`flex gap-4 rounded-2xl border p-5 ${reached ? "border-brand-100 bg-white" : "border-line bg-canvas"}`}>
        <span style={{ opacity: reached ? 1 : 0.45 }}><RankBadge id={rank.id} size={44} /></span>
        <div className="min-w-0"><h2 className="text-lg font-extrabold text-brand-900">{rank.label}</h2><p className="text-sm text-ink-soft">{rank.threshold.toLocaleString("de-DE")} Danke · {reached ? "Erreicht" : `Noch ${(rank.threshold - progress.count).toLocaleString("de-DE")}`}</p>
          <p className="mt-1 text-sm text-ink">Abzeichen{rank.id !== "start" ? " · Rangfarbe" : ""}{rank.reward ? " · Reward" : ""}</p>
        </div></li>;
    })}</ol>
    <aside className="rounded-2xl border border-line bg-brand-50 p-5"><h2 className="font-bold text-brand-900">Rewards · vorbereitete Vorschau</h2><p className="mt-1 text-sm text-ink-soft">{REWARD_PREVIEW}</p></aside>
    <p className="text-sm text-ink-soft">{RANK_EXPLANATION}</p>
  </div>;
}
