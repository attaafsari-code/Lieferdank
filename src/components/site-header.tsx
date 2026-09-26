import Link from "next/link";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { getSession } from "@/lib/auth";

export const NAV_LINKS = [
  { href: "/fahrer", label: "Für Zusteller" },
  { href: "/so-funktionierts", label: "So funktioniert's" },
  { href: "/faq", label: "FAQ" },
];

export async function SiteHeader() {
  const session = await getSession();
  const loggedIn = Boolean(session);

  return (
    <header className="no-print sticky top-0 z-50 border-b border-line/70 bg-white/80 backdrop-blur-xl">
      <div className="container-page flex h-[4.25rem] items-center justify-between">
        <Link href="/" aria-label="Lieferdank – zur Startseite">
          <Logo />
        </Link>

        <nav aria-label="Hauptnavigation" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3.5 py-2 text-[0.9375rem] font-semibold text-ink-soft transition hover:bg-brand-50 hover:text-brand"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Link href="/dashboard" className="btn btn-primary btn-sm">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-quiet hidden sm:inline-flex">
                Anmelden
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Danke-Code holen
              </Link>
            </>
          )}
          <MobileMenu links={NAV_LINKS} loggedIn={loggedIn} />
        </div>
      </div>
    </header>
  );
}
