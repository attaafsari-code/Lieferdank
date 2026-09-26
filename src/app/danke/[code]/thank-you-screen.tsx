"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Heart } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { formatEuro, formatEuroShort } from "@/lib/format";
import { MAX_TIP_CENTS, MIN_TIP_CENTS, TIP_OPTIONS_CENTS } from "@/lib/money";
import { sendFreeThankYou, startTip } from "./actions";

type Props = {
  code: string;
  displayName: string;
  verified: boolean;
  providerLabel: string | null;
  providerVerified: boolean;
  platformFeeCents: number;
  cancelled: boolean;
};

export function ThankYouScreen({
  code,
  displayName,
  verified,
  providerLabel,
  providerVerified,
  platformFeeCents,
  cancelled,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, marker: number) {
    setError(null);
    setBusy(marker);
    startTransition(async () => {
      const result = await action();
      // Bei Erfolg leitet die Server Action weiter -- hier landen wir nur im Fehlerfall.
      if (result && !result.ok) setError(result.error ?? "Das hat leider nicht geklappt.");
      setBusy(null);
    });
  }

  function submitCustom() {
    const euros = Number(customValue.replace(",", ".").trim());
    if (!Number.isFinite(euros)) {
      setError("Bitte gib einen gültigen Betrag ein.");
      return;
    }
    const cents = Math.round(euros * 100);
    if (cents < MIN_TIP_CENTS || cents > MAX_TIP_CENTS) {
      setError(`Möglich sind ${formatEuro(MIN_TIP_CENTS)} bis ${formatEuro(MAX_TIP_CENTS)}.`);
      return;
    }
    run(() => startTip(code, cents), cents);
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <BackdropGlow />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-7 pb-8">
        <header className="text-center">
          <LogoMark className="mx-auto h-9 w-9" />
          <h1 className="mt-4 text-[1.75rem] leading-[1.15] font-extrabold text-brand-900">
            Sag deinem Zusteller Danke
          </h1>
          <p className="mt-2 text-[0.9375rem] text-ink-soft">
            Ein kleines Danke kann viel bedeuten.
          </p>
        </header>

        {/* Wer bekommt das Danke -- steht bewusst vor jeder Aktion. */}
        <section className="mt-6 rounded-2xl border border-line bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-2xl font-extrabold tracking-tight text-ink">{displayName}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            {verified && (
              <span className="chip bg-brand-50 text-brand">
                <Check className="h-3.5 w-3.5" /> Verifizierter Zusteller
              </span>
            )}
            {providerLabel && (
              <span className="text-sm text-ink-soft">
                unterwegs für {providerLabel}
                {!providerVerified && (
                  <span className="text-ink-faint"> · eigene Angabe</span>
                )}
              </span>
            )}
          </div>
        </section>

        {cancelled && (
          <p className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-center text-sm font-medium text-brand-900">
            Zahlung abgebrochen. Danke sagen geht natürlich weiterhin kostenlos.
          </p>
        )}

        <button
          type="button"
          onClick={() => run(() => sendFreeThankYou(code), 0)}
          disabled={pending}
          className="btn btn-coral btn-lg mt-5 w-full"
        >
          {busy === 0 ? (
            <Spinner label="Wird gesendet" />
          ) : (
            <>
              <Heart className="h-[1.15rem] w-[1.15rem]" />
              Kostenlos Danke sagen
            </>
          )}
        </button>

        <div className="mt-8 flex items-center gap-4">
          <span className="h-px flex-1 bg-line" />
          <span className="eyebrow">oder Trinkgeld geben</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {TIP_OPTIONS_CENTS.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => run(() => startTip(code, cents), cents)}
              disabled={pending}
              className="group flex flex-col items-center gap-0.5 rounded-2xl border-[1.5px] border-line bg-white py-4 shadow-xs transition hover:border-brand hover:shadow-sm disabled:opacity-50"
            >
              {busy === cents ? (
                <Spinner label="Moment" tone="dark" />
              ) : (
                <>
                  <span className="text-[1.375rem] leading-none font-extrabold text-ink transition group-hover:text-brand">
                    {formatEuroShort(cents)}
                  </span>
                  {/* Transparenz direkt am Button, nicht im Kleingedruckten. */}
                  <span className="text-[0.6875rem] leading-tight text-ink-faint">
                    {displayName} erhält
                    <br />
                    <span className="font-semibold text-ink-soft">
                      {formatEuro(cents - platformFeeCents)}
                    </span>
                  </span>
                </>
              )}
            </button>
          ))}
        </div>

        {customOpen ? (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCustom()}
              placeholder="z. B. 4,00"
              aria-label="Anderer Betrag in Euro"
              className="field flex-1"
            />
            <button
              type="button"
              onClick={submitCustom}
              disabled={pending}
              className="btn btn-primary !px-5"
            >
              Geben
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="btn btn-quiet mx-auto mt-3"
          >
            Anderer Betrag
          </button>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-2xl bg-coral-50 px-4 py-3 text-center text-sm font-semibold text-coral-600"
          >
            {error}
          </p>
        )}

        <p className="mt-7 text-center text-[0.8125rem] leading-relaxed text-ink-soft">
          Du zahlst genau den Betrag, den du auswählst – ohne Aufschlag im Checkout.
          <br />
          {formatEuro(platformFeeCents)} je Trinkgeld decken Zahlungsabwicklung und
          Lieferdank.
        </p>

        <footer className="mt-auto pt-10 text-center text-xs text-ink-faint">
          <Link href="/" className="transition hover:text-brand">
            Was ist Lieferdank?
          </Link>
          <span className="mx-2">·</span>
          <Link href="/legal/datenschutz" className="transition hover:text-brand">
            Datenschutz
          </Link>
          <span className="mx-2">·</span>
          <Link href="/legal/impressum" className="transition hover:text-brand">
            Impressum
          </Link>
        </footer>
      </div>
    </div>
  );
}

function BackdropGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
      <div className="absolute -right-24 top-56 h-56 w-56 rounded-full bg-coral-100/50 blur-3xl" />
    </div>
  );
}

function Spinner({ label, tone = "light" }: { label: string; tone?: "light" | "dark" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-4 w-4 animate-spin rounded-full border-2 border-transparent ${
          tone === "light" ? "border-t-white border-r-white/60" : "border-t-brand border-r-brand/50"
        }`}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
