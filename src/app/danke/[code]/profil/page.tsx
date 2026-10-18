import Link from "next/link";
import { notFound } from "next/navigation";
import { findReceivingDriver, toPublicDriver } from "@/server/services/drivers";
import { getDriverRank } from "@/server/services/ranks";
import { RankJourney } from "@/components/ranks";
import { Avatar } from "@/components/avatar";
import { LegalLinks } from "@/components/legal-links";
import { CopyButton } from "@/components/copy-button";
import { baseUrl } from "@/server/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Öffentliches Rangprofil", robots: { index: false, follow: false } };
export default async function PublicRankPage({ params }: { params: Promise<{ code: string }> }) {
  const found = await findReceivingDriver((await params).code); if (!found) notFound();
  const driver = toPublicDriver(found.driver, found.user), progress = await getDriverRank(found.driver.id);
  return <div className="mx-auto w-full max-w-3xl space-y-7 px-5 py-8"><Link href={`/danke/${driver.code}`} className="font-semibold text-brand">← Danke sagen</Link>
    <header className="flex items-center gap-4"><Avatar name={driver.name} initials={driver.initials} photoUrl={driver.photoUrl} size="lg" /><div><h1 className="text-3xl font-extrabold text-brand-900">{driver.name}</h1><p className="text-sm text-ink-soft">LieferDank · {driver.code}</p></div></header>
    {driver.bio && <p className="text-ink-soft">{driver.bio}</p>}
    <RankJourney progress={progress} /><p className="text-xs text-ink-faint">Aktueller serverseitiger Stand beim Seitenaufruf. Gedruckte Abzeichen zeigen den Stand beim Druck; dieses Profil zeigt den aktuellen Rang.</p>
    <CopyButton value={`${baseUrl()}/danke/${driver.code}/profil`} label="Profillink kopieren" /><LegalLinks />
  </div>;
}
