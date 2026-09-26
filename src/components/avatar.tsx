/* eslint-disable @next/next/no-img-element */

type Props = {
  name: string;
  initials: string;
  photoUrl: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZES = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-2xl",
  xl: "h-24 w-24 text-3xl",
};

/** Profilfoto oder – ohne Foto – ein ruhiger Avatar mit Initialen. */
export function Avatar({ name, initials, photoUrl, size = "md", className = "" }: Props) {
  const base = `${SIZES[size]} shrink-0 rounded-full ring-4 ring-white shadow-sm ${className}`;
  if (photoUrl) {
    return <img src={photoUrl} alt={`Foto von ${name}`} className={`${base} object-cover`} />;
  }
  return (
    <span
      aria-hidden
      className={`${base} grid place-items-center bg-gradient-to-br from-brand-50 to-brand-100 font-extrabold tracking-tight text-brand`}
    >
      {initials}
    </span>
  );
}
