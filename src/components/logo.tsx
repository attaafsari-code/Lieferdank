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

/** Bildmarke: Paket in Bewegung, Herz als Wertschätzung. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Lieferdank">
      <g
        stroke="var(--color-brand-400)"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.9"
      >
        <line x1="2" y1="12.5" x2="9" y2="12.5" />
        <line x1="1" y1="19.5" x2="7" y2="19.5" />
        <line x1="3" y1="26.5" x2="9" y2="26.5" />
      </g>
      <path
        d="M13.5 11.5 23.5 6.5l10 5v12l-10 5-10-5z"
        fill="none"
        stroke="var(--color-brand-900)"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 11.5 23.5 16.5l10-5M23.5 16.5v12"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M24.6 27.6c0-2.1 1.7-3.6 3.5-3.6 1.05 0 2 .5 2.55 1.3.55-.8 1.5-1.3 2.55-1.3 1.8 0 3.5 1.5 3.5 3.6 0 3.2-4.35 5.95-6.05 7-1.7-1.05-6.05-3.8-6.05-7z"
        fill="var(--color-coral)"
        stroke="#fff"
        strokeWidth="2.2"
      />
    </svg>
  );
}
