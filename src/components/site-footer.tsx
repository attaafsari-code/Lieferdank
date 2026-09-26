import Link from "next/link";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Produkt",
    links: [
      { href: "/fahrer", label: "Für Zusteller" },
      { href: "/so-funktionierts", label: "So funktioniert's" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Konto",
    links: [
      { href: "/register", label: "Registrieren" },
      { href: "/login", label: "Anmelden" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { href: "/legal/impressum", label: "Impressum" },
      { href: "/legal/datenschutz", label: "Datenschutz" },
      { href: "/legal/agb", label: "AGB" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print mt-28 border-t border-line bg-white">
      <div className="container-page py-14">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Logo tagline />
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-ink-soft">
              Lieferdank macht es einfach, dem Menschen hinter der Lieferung Danke zu
              sagen.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-8 text-[0.9375rem] sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="mb-3.5 font-bold text-ink">{column.title}</p>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-ink-soft transition hover:text-brand"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-12 border-t border-line pt-7 text-xs leading-relaxed text-ink-faint">
          © {new Date().getFullYear()} Lieferdank · Danke sagen ist kostenlos, Trinkgeld
          ist freiwillig. Lieferdank steht in keiner Verbindung zu den genannten
          Zustelldiensten.
        </p>
      </div>
    </footer>
  );
}
