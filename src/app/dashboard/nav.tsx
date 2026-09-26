"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Übersicht" },
  { href: "/dashboard/code", label: "Mein Code" },
  { href: "/dashboard/einnahmen", label: "Einnahmen" },
  { href: "/dashboard/danke", label: "Danke" },
  { href: "/dashboard/profil", label: "Profil" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard-Navigation" className="no-print border-t border-line/70">
      <div
        className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3.5 py-2"
        style={{ scrollbarWidth: "none" }}
      >
        {ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-[0.9375rem] font-semibold transition ${
                active
                  ? "bg-brand-50 text-brand"
                  : "text-ink-soft hover:bg-canvas hover:text-ink"
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
