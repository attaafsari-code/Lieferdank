import Link from "next/link";

const LINKS = [
  { href: "/legal/impressum", label: "Impressum" },
  { href: "/legal/datenschutz", label: "Datenschutz" },
  { href: "/legal/agb", label: "AGB" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/vertrag-widerrufen", label: "Vertrag widerrufen" },
  { href: "/vertrag-kuendigen", label: "Verträge hier kündigen" },
] as const;

/** Rechtslinks für Seiten ohne Site-Footer: Dashboard und die Schritte des Danke-Flows. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Rechtliches" className={`flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs ${className}`}>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="transition hover:text-brand">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
