"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CardIcon, Euro, HeartOutline, HomeIcon, UserIcon } from "@/components/icons";

const ITEMS = [
  { href: "/dashboard", label: "Übersicht", icon: HomeIcon },
  { href: "/dashboard/karte", label: "Karte", icon: CardIcon },
  { href: "/dashboard/einnahmen", label: "Einnahmen", icon: Euro },
  { href: "/dashboard/danke", label: "Danke", icon: HeartOutline },
  { href: "/dashboard/profil", label: "Profil", icon: UserIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

/** Desktop: Tabs unter dem Header. */
export function DashboardTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="no-print hidden border-t border-line/70 md:block">
      <div className="mx-auto flex max-w-4xl gap-1 px-3.5 py-2">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[0.9375rem] font-semibold transition ${
                active ? "bg-brand-50 text-brand" : "text-ink-soft hover:bg-canvas hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Mobil: feste Tab-Leiste unten, wie in einer nativen App. */
export function DashboardBottomBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Dashboard"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[0.6875rem] font-semibold transition ${
                active ? "text-brand" : "text-ink-faint"
              }`}
            >
              <Icon className="h-[1.35rem] w-[1.35rem]" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
