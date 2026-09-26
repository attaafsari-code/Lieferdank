"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "@/components/icons";
import { saveDriverAction } from "@/server/actions/customer-flow";

type Props = { code: string; name: string; alreadySaved: boolean; loggedIn: boolean };

/**
 * „Lieferant speichern“. Mit Kundenkonto sofort, ohne Konto erst ein kurzer,
 * freundlicher Hinweis – keine Pflicht, keine Werbeschleife.
 */
export function SaveDriver({ code, name, alreadySaved, loggedIn }: Props) {
  const [saved, setSaved] = useState(alreadySaved);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (saved) {
    return (
      <p className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-brand">
        <Check className="h-4 w-4" />
        {name} ist in{" "}
        <Link href="/konto" className="underline underline-offset-2">
          Meine Lieferanten
        </Link>
      </p>
    );
  }

  function save() {
    setError(null);
    if (!loggedIn) {
      setNeedsAccount(true);
      return;
    }
    startTransition(async () => {
      const result = await saveDriverAction(code);
      if (result.ok) setSaved(true);
      else if (result.needsAccount) setNeedsAccount(true);
      else setError(result.error ?? "Das hat nicht geklappt.");
    });
  }

  return (
    <section className="mt-8">
      {!needsAccount ? (
        <button type="button" onClick={save} disabled={pending} className="btn btn-ghost w-full">
          {pending ? "Wird gespeichert …" : `${name} speichern`}
        </button>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5 text-center shadow-xs">
          <p className="font-semibold text-ink">{name} wiederfinden</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            Mit einem kostenlosen Lieferdank-Konto speicherst du deine Lieblingslieferanten und
            kannst ihnen jederzeit wieder Danke sagen.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href={`/konto/registrieren?merken=${encodeURIComponent(code)}`} className="btn btn-primary btn-sm">
              Konto erstellen
            </Link>
            <Link href={`/login?merken=${encodeURIComponent(code)}`} className="btn btn-ghost btn-sm">
              Anmelden
            </Link>
          </div>
        </div>
      )}
      {error && <p className="error-text text-center">{error}</p>}
    </section>
  );
}
