import Link from "next/link";
import { requireAdmin } from "@/server/guards";
import { getDb } from "@/lib/db";
import { rankAdminOverview } from "@/server/services/ranks";
import { REWARD_THRESHOLDS, REWARD_PREVIEW } from "@/lib/ranks";
import { RankBadge } from "@/components/ranks";
import { RewardDraft } from "./draft";

export const dynamic = "force-dynamic";
export default async function AdminRanks({ searchParams }: { searchParams: Promise<{ seite?: string }> }) {
  const { user } = await requireAdmin(); const p = Number((await searchParams).seite ?? 0);
  const page = Number.isSafeInteger(p) && p >= 0 && p <= 10000 ? p : 0;
  const [overview, drafts] = await Promise.all([rankAdminOverview(user, page), getDb().rewardDefinitions.findMany()]);
  return <div className="space-y-7"><header><h1 className="text-3xl font-extrabold text-brand-900">Ränge & Rewards</h1><p className="mt-2 text-ink-soft">{REWARD_PREVIEW} Öffentliche Aktivierung erst nach gesonderter Freigabe der Inhalte und Bedingungen.</p></header>
    <div className="overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line"><th className="p-4">Danke-Code</th><th>Gültige Danke</th><th>Rang</th><th className="pr-4">Reward-Vorschau ab</th></tr></thead><tbody>{overview.items.map(row => <tr key={row.code} className="border-b border-line"><td className="p-4"><Link href={`/danke/${row.code}/profil`} className="font-semibold text-brand">{row.code}</Link>{!row.active && <span className="block text-xs">Inaktiv</span>}</td><td>{row.progress.count.toLocaleString("de-DE")}</td><td><span className="flex items-center gap-2">{row.progress.current && <RankBadge id={row.progress.current.id} size={24} />}{row.progress.current?.label ?? "Noch kein Rang"}</span></td><td className="pr-4">{row.rewardThresholds.length ? row.rewardThresholds.map(t => t.toLocaleString("de-DE")).join(" · ") : "—"}</td></tr>)}</tbody></table></div>
    <nav className="flex flex-wrap gap-3" aria-label="Rangseiten">{page > 0 && <Link className="btn btn-ghost" href={`/admin/raenge?seite=${page - 1}`}>Zurück</Link>}{overview.hasMore && <Link className="btn btn-ghost" href={`/admin/raenge?seite=${page + 1}`}>Weitere</Link>}</nav>
    <h2 className="text-xl font-bold text-brand-900">Reward-Inhalte und Bedingungen vorbereiten</h2><div className="grid gap-4 lg:grid-cols-2">{REWARD_THRESHOLDS.map(threshold => { const initial = drafts.find(d => d.threshold === threshold) ?? null; return <RewardDraft key={threshold} threshold={threshold} initial={initial} />; })}</div>
  </div>;
}
