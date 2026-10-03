"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Heart } from "@/components/icons";
import { Avatar } from "@/components/avatar";
import { LogoMark } from "@/components/logo";
import { formatEuroShort } from "@/lib/format";
import { TIP_OPTIONS_CENTS } from "@/lib/money";
import { dativeName } from "@/lib/names";
import type { PublicDriver } from "@/server/services/drivers";
import { sendThanksAction, startTipAction, type FlowResult } from "@/server/actions/customer-flow";

type Props = {
  driver: PublicDriver;
  paymentMethods: string;
  cancelled: boolean;
};

export function ThankYouScreen({ driver, paymentMethods, cancelled }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const active = useRef(false);

  function run(action: () => Promise<FlowResult>, marker: number) {
    if (active.current) return;
    active.current = true;
    setError(null);
    setBusy(marker);
    startTransition(async () => {
      try {
        // Bei Erfolg leitet die Aktion weiter – hier landen wir nur im Fehlerfall.
        const result = await action();
        if (result && !result.ok) setError(result.error ?? "Das hat leider nicht geklappt.");
      } catch {
        setError("Die Verbindung ist unterbrochen. Bitte versuch es erneut.");
      } finally {
        active.current = false;
        setBusy(null);
      }
    });
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="absolute -right-24 top-56 h-56 w-56 rounded-full bg-coral-100/50 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-8">
        <LogoMark className="mx-auto h-7 w-7 opacity-90" />

        {/* Wer bekommt das Danke – steht bewusst vor jeder Aktion. */}
        <header className="mt-5 flex flex-col items-center text-center">
          <Avatar name={driver.name} initials={driver.initials} photoUrl={driver.photoUrl} size="lg" />

          <h1 className="mt-4 text-[1.75rem] leading-[1.15] font-extrabold tracking-tight text-brand-900">
            Sag {dativeName(driver.name)} Danke <span className="text-coral">❤</span>
          </h1>

          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
            {driver.verified && (
              <span className="chip bg-brand-50 text-brand">
                <Check className="h-3.5 w-3.5" /> Verifiziert
              </span>
            )}
          </div>

          {driver.tagline && (
            <p className="mt-3 max-w-xs text-[0.9375rem] leading-relaxed text-ink-soft">„{driver.tagline}“</p>
          )}
        </header>

        {cancelled && (
          <p className="mt-5 rounded-2xl bg-brand-50 px-4 py-3 text-center text-sm font-medium text-brand-900">
            Zahlung abgebrochen. Danke sagen geht natürlich weiterhin kostenlos.
          </p>
        )}

        <button
          type="button"
          onClick={() => run(() => sendThanksAction(driver.code), 0)}
          disabled={pending}
          className="btn btn-coral btn-lg mt-6 w-full"
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

        <div className="mt-7 flex items-center gap-4">
          <span className="h-px flex-1 bg-line" />
          <span className="eyebrow">oder Trinkgeld geben</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {!driver.tipReady && (
          <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-center text-sm text-brand-900">
            Trinkgeld ist für diesen Lieferanten noch nicht eingerichtet. Kostenlos Danke sagen funktioniert schon.
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {TIP_OPTIONS_CENTS.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => run(() => startTipAction(driver.code, cents), cents)}
              disabled={pending || !driver.tipReady}
              className="group flex min-h-[4.5rem] items-center justify-center rounded-2xl border-[1.5px] border-line bg-white py-3 shadow-xs transition hover:border-brand hover:shadow-sm disabled:opacity-50"
            >
              {busy === cents ? (
                <Spinner label="Moment" tone="dark" />
              ) : (
                <span className="text-[1.5rem] leading-none font-extrabold text-ink transition group-hover:text-brand">
                  {formatEuroShort(cents)}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-coral-50 px-4 py-3 text-center text-sm font-semibold text-coral-600"
          >
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-[0.8125rem] leading-relaxed text-ink-soft">
          {paymentMethods} · ohne Konto, ohne App.
          <br />
          Du zahlst genau den gewählten Betrag.
        </p>
        {/* Neutraler Pflichthinweis: Abzüge werden erwähnt, aber nicht beziffert (Details in AGB/Info-Seite). */}
        <p className="mt-2 text-center text-[0.6875rem] leading-relaxed text-ink-faint">
          Vom Betrag werden Zahlungs- und Plattformkosten abgezogen.{" "}
          <Link href="/so-funktionierts#geld" className="underline underline-offset-2 transition hover:text-brand">
            Mehr erfahren
          </Link>
        </p>

        {driver.bio && (
          <section className="mt-8 rounded-2xl border border-line bg-white/80 p-5">
            <h2 className="text-sm font-bold text-ink">Über {driver.name}</h2>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-soft">{driver.bio}</p>
          </section>
        )}

        {/* Diese Seite ist die bei Stripe hinterlegte Website des Lieferanten: Anbieter, Kontakt und Bedingungen müssen von hier erreichbar sein. */}
        <footer className="mt-auto pt-10 text-xs text-ink-faint">
          <nav aria-label="Rechtliches und Kontakt" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            <Link href="/" className="transition hover:text-brand">
              Was ist Lieferdank?
            </Link>
            <Link href="/legal/agb" className="transition hover:text-brand">
              AGB
            </Link>
            <Link href="/legal/agb#rueckerstattungen" className="transition hover:text-brand">
              Erstattungen
            </Link>
            <Link href="/legal/datenschutz" className="transition hover:text-brand">
              Datenschutz
            </Link>
            <Link href="/legal/impressum" className="transition hover:text-brand">
              Impressum &amp; Kontakt
            </Link>
          </nav>
        </footer>
      </div>
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
