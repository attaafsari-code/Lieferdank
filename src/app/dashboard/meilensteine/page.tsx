import Link from "next/link";
import { requireDriver } from "@/server/guards";
import { getDriverRank } from "@/server/services/ranks";
import { RankJourney } from "@/components/ranks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rang & Meilensteine", robots: { index: false, follow: false } };
export default async function MilestonesPage() {
  const { driver } = await requireDriver(); const progress = await getDriverRank(driver.id);
  return <div className="space-y-6"><Link className="font-semibold text-brand" href="/dashboard">← Zur Übersicht</Link><header><h1 className="text-3xl font-extrabold text-brand-900">Dein Rang & deine Meilensteine</h1><p className="mt-2 text-ink-soft">Jedes gültige Danke zählt. Dein Kartendesign bestimmst weiterhin du.</p></header><RankJourney progress={progress} /><Link href="/dashboard/karte" className="btn btn-primary">Freigeschaltete Farben ansehen</Link><Link href={`/danke/${driver.code}/profil`} className="btn btn-ghost">Öffentliches Rangprofil ansehen</Link></div>;
}
