import Link from "next/link";
export const metadata = { title: "LieferDank-Konto löschen", robots: { index: false, follow: false } };
export default function AccountDeletion() {
  return <main className="mx-auto max-w-lg px-6 py-16"><h1 className="text-2xl font-bold">LieferDank-Konto löschen</h1>
    <p className="my-6">In der Fahrer-App findest du „Konto löschen“ unter Einstellungen. Im Web meldest du dich an und öffnest dein Profil. Dort kannst du dein Konto löschen.</p>
    <Link href="/dashboard/profil" className="btn btn-primary">Zum Webprofil</Link>
    <p className="my-6">Offene Zahlungen müssen zuvor geklärt werden. Zahlungsdaten mit gesetzlichen Aufbewahrungsfristen bleiben erhalten.</p>
    <Link href="/kontakt" className="underline">Hilfe bei der Kontolöschung</Link><p className="mt-6"><Link href="/legal/datenschutz" className="underline">Datenschutz und Aufbewahrung</Link></p>
  </main>;
}
