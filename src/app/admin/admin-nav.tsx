"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/nutzer", label: "Nutzer & Codes" },
  { href: "/admin/zahlungen", label: "Transaktionen" },
  { href: "/admin/auszahlungen", label: "Auszahlungen" },
  { href: "/admin/karten", label: "Kartenbestellungen" },
  { href: "/admin/system", label: "System" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="border-t border-line/70">
      <div className="container-page flex gap-1 overflow-x-auto py-2" style={{ scrollbarWidth: "none" }}>
        {ITEMS.map((item) => {
          const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                active ? "bg-brand-50 text-brand" : "text-ink-soft hover:bg-canvas hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
