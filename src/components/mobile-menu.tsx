"use client";

import NextLink from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

export function MobileMenu({
  links,
  loggedIn,
  home = "/dashboard",
  homeLabel = "Dashboard",
}: {
  links: NavLink[];
  loggedIn: boolean;
  home?: string;
  homeLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Nach einem Seitenwechsel darf das Menü nicht offen stehen bleiben.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * Das Overlay hängt bewusst am <body>, nicht im Header.
   * Der Header nutzt backdrop-blur und wäre damit Containing Block für
   * position:fixed – das Menü würde sonst im Header eingesperrt.
   */
  const overlay = open ? (
    <div
      id="mobile-menu"
      className="fixed inset-0 z-[60] flex flex-col bg-white md:hidden"
    >
      <div className="flex h-[4.25rem] shrink-0 items-center justify-end px-5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Menü schließen"
          className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-line bg-white text-ink"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-10">
        <nav aria-label="Hauptnavigation" className="flex flex-col gap-1">
          {links.map((link) => (
            <NextLink
              key={link.href}
              href={link.href}
              className="rounded-xl px-4 py-3.5 text-lg font-semibold text-ink transition hover:bg-brand-50 hover:text-brand"
            >
              {link.label}
            </NextLink>
          ))}
        </nav>

        <div className="mt-8 space-y-2.5 border-t border-line pt-8">
          {loggedIn ? (
            <NextLink href={home} className="btn btn-primary w-full">
              {homeLabel}
            </NextLink>
          ) : (
            <>
              <NextLink href="/register" className="btn btn-primary w-full">
                Als Lieferant starten
              </NextLink>
              <NextLink href="/login" className="btn btn-ghost w-full">
                Anmelden
              </NextLink>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label="Menü öffnen"
        className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-line bg-white text-ink transition hover:border-brand-200 md:hidden"
      >
        <MenuIcon />
      </button>

      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
