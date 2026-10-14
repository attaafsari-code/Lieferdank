type Props = { className?: string; showWordmark?: boolean; tagline?: boolean };

/**
 * Wortmarke als SVG statt PNG: bleibt auf jedem Hintergrund scharf, hat keinen
 * weißen Kasten und braucht keinen zusätzlichen Request.
 */
export function Logo({ className = "", showWordmark = true, tagline = false }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8 shrink-0" />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-[1.3rem] font-extrabold tracking-[-0.03em]">
            <span className="text-brand-900">Liefer</span>
            <span className="text-coral">dank</span>
          </span>
          {tagline && (
            <span className="mt-1.5 text-[0.7rem] font-medium tracking-tight text-ink-soft">
              Dein Danke kommt an.
            </span>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Bildmarke: Paket in Bewegung (komplett in Markenblau, ohne dunkle Außenlinie),
 * Herz als Wertschätzung – ohne weißen Rand, auf transparentem Grund.
 * Identisch mit der Marke in der App (apps/driver/src/ui.tsx).
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-1 0 45 40" className={className} role="img" aria-label="Lieferdank">
      <g stroke="var(--color-brand-400)" strokeWidth="2.6" strokeLinecap="round">
        <line x1="2" y1="13" x2="9" y2="13" />
        <line x1="1" y1="20" x2="7" y2="20" />
        <line x1="3" y1="27" x2="9" y2="27" />
      </g>
      <path d="M13.5 12 23.5 7l10 5v12l-10 5-10-5z" fill="none" stroke="var(--color-brand)" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M13.5 12 23.5 17l10-5M23.5 17v12" fill="none" stroke="var(--color-brand)" strokeWidth="2.2" strokeLinejoin="round" />
      <path
        d="M28 27.4c0-2.55 2-4.35 4.2-4.35 1.3 0 2.45.6 3.1 1.55.65-.95 1.8-1.55 3.1-1.55 2.2 0 4.2 1.8 4.2 4.35 0 3.9-5.25 7.2-7.3 8.5-2.05-1.3-7.3-4.6-7.3-8.5z"
        fill="var(--color-coral)"
      />
    </svg>
  );
}
