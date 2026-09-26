"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";

/** Auffangnetz für unerwartete Fehler – der Nutzer soll nie eine leere Seite sehen. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unerwarteter Fehler:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <LogoMark className="h-12 w-12" />
      <h1 className="mt-7 text-3xl font-extrabold tracking-tight text-brand-900">
        Da ist etwas schiefgegangen
      </h1>
      <p className="mt-3 max-w-sm leading-relaxed text-ink-soft">
        Der Fehler liegt bei uns, nicht bei dir. Versuch es bitte noch einmal.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-ink-faint">Referenz: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
        <button type="button" onClick={reset} className="btn btn-primary">
          Erneut versuchen
        </button>
        <Link href="/" className="btn btn-ghost">
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
