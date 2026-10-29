type Props = { className?: string; showWordmark?: boolean; tagline?: boolean };

/**
 * Original-Logo (assets/brand/lieferdank-logo-original.png): Bildmarke und
 * Schriftzug sind unveränderte Ausschnitte mit transparentem Hintergrund, erzeugt
 * von scripts/brand/generate_brand_assets.py. Dieselben Dateien nutzen App und Karten.
 */
export function Logo({ className = "", showWordmark = true, tagline = false }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 sm:gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-auto shrink-0 sm:h-9" />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- statische Markendatei, keine Optimierung nötig */}
          <img src="/brand/lieferdank-wordmark.png" alt="Lieferdank" width={1476} height={239} className="h-[1.1875rem] w-auto max-w-none shrink-0 sm:h-[1.375rem]" />
          {tagline && (
            // eslint-disable-next-line @next/next/no-img-element -- statische Markendatei
            <img src="/brand/lieferdank-tagline.png" alt="Dein Danke kommt an." width={944} height={78} className="mt-1.5 h-[0.625rem] w-auto self-start" />
          )}
        </span>
      )}
    </span>
  );
}

/** Bildmarke des Originals: Paket mit Klebestreifen und Herz, ohne weißen Rand. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- statische Markendatei, keine Optimierung nötig
    <img src="/brand/lieferdank-mark.png" alt="Lieferdank" width={950} height={503} className={className} />
  );
}
