type IconProps = { className?: string };

export function Heart({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 21s-7.6-4.7-9.7-9.1C.6 8.3 2.6 4.5 6.3 4.5c2 0 3.4 1 4.4 2.3.2.3.4.6.5.9h1.6c.1-.3.3-.6.5-.9 1-1.3 2.4-2.3 4.4-2.3 3.7 0 5.7 3.8 4 7.4C19.6 16.3 12 21 12 21z" />
    </svg>
  );
}

export function Check({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none">
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowRight({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none">
      <path
        d="M3 8h10m0 0-4-4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Euro({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path
        d="M16.5 6.2A6 6 0 0 0 7.2 9m0 6a6 6 0 0 0 9.3 2.8M4 10.5h8M4 13.5h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Download({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none">
      <path
        d="M8 2v8m0 0L5 7m3 3 3-3M2.5 12.5h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Printer({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none">
      <path
        d="M4.5 6V2.5h7V6M4.5 12H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1.5M4.5 10h7v3.5h-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

export function CardIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M6.5 9.5h3.5v3.5H6.5zM13 10h4.5M13 13.5h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function HeartOutline({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M12 20s-7-4.4-8.9-8.5C1.5 8.2 3.4 5 6.6 5c1.9 0 3.2 1 4.1 2.2l1.3 1.6 1.3-1.6C14.2 6 15.5 5 17.4 5c3.2 0 5.1 3.2 3.5 6.5C19 15.6 12 20 12 20z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}
