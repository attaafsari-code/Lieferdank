"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { CardLayout } from "@/lib/db/types";
import { CARD_LAYOUTS, HEADLINE_PRESETS, MAX_HEADLINE_LENGTH } from "@/lib/card/design";
import { renderCardSvg, type CardRenderInput } from "@/lib/card/svg";
import { downloadBlob, embeddedFontCss, svgToPngBlob, urlToDataUrl } from "@/lib/card/export";
import { saveCardDesignAction } from "@/server/actions/driver";
import { Check, Download, Printer } from "@/components/icons";

type Props = {
  initial: { layout: CardLayout; headline: string; showPhoto: boolean; showProvider: boolean };
  qrSvg: string;
  publicName: string;
  initials: string;
  photoUrl: string | null;
  code: string;
};

export function CardDesigner(props: Props) {
  const [layout, setLayout] = useState<CardLayout>(props.initial.layout);
  const [headline, setHeadline] = useState(props.initial.headline);
  const [showPhoto, setShowPhoto] = useState(props.initial.showPhoto && Boolean(props.photoUrl));
  const showProvider = props.initial.showProvider;
  const [saved, setSaved] = useState(props.initial);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"png" | "svg" | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    layout !== saved.layout || headline !== saved.headline || showPhoto !== saved.showPhoto;

  const renderInput = (overrides: Partial<CardRenderInput> = {}): CardRenderInput => ({
    layout,
    headline,
    publicName: props.publicName,
    providerLabel: null,
    code: props.code,
    qrSvg: props.qrSvg,
    avatar: showPhoto || layout === "personal" ? { href: showPhoto ? props.photoUrl : null, initials: props.initials } : null,
    ...overrides,
  });

  const preview = useMemo(() => renderCardSvg(renderInput({ idPrefix: "editor" })), [layout, headline, showPhoto]); // eslint-disable-line react-hooks/exhaustive-deps

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveCardDesignAction({ layout, headline, showPhoto, showProvider });
      if (result.error || result.fieldErrors) {
        setError(result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? "Speichern fehlgeschlagen.");
        return;
      }
      setSaved({ layout, headline, showPhoto, showProvider });
      setStatus("Gespeichert");
      setTimeout(() => setStatus(null), 2500);
    });
  }

  /** Export: Foto und Schrift werden eingebettet, damit die Datei überall gleich aussieht. */
  async function exportSvg(): Promise<string> {
    const [fontCss, photo] = await Promise.all([
      embeddedFontCss(),
      showPhoto && props.photoUrl ? urlToDataUrl(props.photoUrl) : Promise.resolve(null),
    ]);
    const input = renderInput({ embeddedFontCss: fontCss, idPrefix: "export" });
    if (input.avatar && photo) input.avatar = { ...input.avatar, href: photo };
    return renderCardSvg(input);
  }

  async function download(kind: "png" | "svg") {
    setError(null);
    setExporting(kind);
    try {
      const svg = await exportSvg();
      const filename = `lieferdank-karte-${props.code}.${kind}`;
      if (kind === "svg") downloadBlob(new Blob([svg], { type: "image/svg+xml" }), filename);
      else downloadBlob(await svgToPngBlob(svg), filename);
    } catch {
      setError("Der Export hat nicht geklappt. Bitte versuch es noch einmal.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-start">
      {/* Vorschau */}
      <div className="lg:sticky lg:top-40">
        <div className="rounded-3xl bg-gradient-to-br from-brand-50 via-white to-coral-50 p-5 sm:p-8">
          <div
            className="overflow-hidden rounded-[0.9rem] shadow-lg [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
        <p className="mt-3 text-center text-xs text-ink-faint">Originalgröße 85,6 × 54 mm · wie eine EC-Karte</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => download("png")} disabled={exporting !== null} className="btn btn-ghost btn-sm">
            <Download className="h-4 w-4" />
            {exporting === "png" ? "…" : "PNG"}
          </button>
          <button type="button" onClick={() => download("svg")} disabled={exporting !== null} className="btn btn-ghost btn-sm">
            <Download className="h-4 w-4" />
            {exporting === "svg" ? "…" : "SVG"}
          </button>
          {dirty ? (
            <button type="button" disabled className="btn btn-ghost btn-sm" title="Erst speichern">
              <Printer className="h-4 w-4" /> Drucken
            </button>
          ) : (
            <Link href="/dashboard/karte/drucken" className="btn btn-ghost btn-sm">
              <Printer className="h-4 w-4" /> Drucken
            </Link>
          )}
        </div>
        {dirty && <p className="mt-2 text-center text-xs text-ink-faint">Zum Drucken zuerst speichern.</p>}
      </div>

      {/* Einstellungen */}
      <div className="space-y-7">
        <fieldset>
          <legend className="label">Design</legend>
          <div className="grid grid-cols-3 gap-2">
            {CARD_LAYOUTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLayout(option.id)}
                aria-pressed={layout === option.id}
                className={`rounded-2xl border-[1.5px] p-2.5 text-left transition ${
                  layout === option.id ? "border-brand bg-brand-50" : "border-line bg-white hover:border-brand-200"
                }`}
              >
                <span
                  aria-hidden
                  className={`block h-9 rounded-lg ${
                    option.id === "brand" ? "bg-brand" : option.id === "personal" ? "bg-gradient-to-r from-brand-100 to-white" : "bg-canvas"
                  }`}
                />
                <span className="mt-2 block text-sm font-bold text-ink">{option.label}</span>
                <span className="block text-[0.6875rem] leading-tight text-ink-soft">{option.description}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="headline" className="label">
            Dein Text auf der Karte
          </label>
          <input
            id="headline"
            value={headline}
            maxLength={MAX_HEADLINE_LENGTH}
            onChange={(event) => setHeadline(event.target.value)}
            className="field"
          />
          <div className="mt-1.5 flex justify-between text-xs text-ink-faint">
            <span>Kurz wirkt am besten.</span>
            <span>
              {headline.length}/{MAX_HEADLINE_LENGTH}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {HEADLINE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setHeadline(preset)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  headline === preset ? "border-brand bg-brand-50 text-brand" : "border-line bg-white text-ink-soft hover:border-brand-200"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <Toggle
            label="Profilfoto auf der Karte"
            hint={props.photoUrl ? undefined : "Lade zuerst ein Foto im Profil hoch."}
            checked={showPhoto}
            disabled={!props.photoUrl}
            onChange={setShowPhoto}
          />
        </div>

        <p className="text-sm text-ink-soft">
          Name auf der Karte: <span className="font-semibold text-ink">„{props.publicName}“</span> ·{" "}
          <Link href="/dashboard/profil" className="font-semibold text-brand hover:underline">
            ändern
          </Link>
        </p>

        {error && (
          <p role="alert" className="rounded-2xl bg-coral-50 px-4 py-3 text-sm font-semibold text-coral-600">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4">
          <button type="button" onClick={save} disabled={pending || !dirty} className="btn btn-primary">
            {pending ? "Wird gespeichert …" : "Design speichern"}
          </button>
          {status && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-brand">
              <Check className="h-4 w-4" /> {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span>
        <span className="block text-[0.9375rem] font-semibold text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-line"} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
    </label>
  );
}
