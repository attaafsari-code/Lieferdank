import Link from "next/link";
import { LogoMark } from "./logo";

/** Gemeinsamer Rahmen für Anmeldung, Registrierung und Passwort-Reset. */
export function AuthShell({
  title,
  lead,
  children,
  footer,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
      </div>

      <div className="relative container-page max-w-md py-16 sm:py-20">
        <div className="text-center">
          <Link href="/" aria-label="Zur Startseite">
            <LogoMark className="mx-auto h-10 w-10" />
          </Link>
          <h1 className="mt-5 text-3xl font-extrabold text-brand-900">{title}</h1>
          {lead && <p className="mt-3 leading-relaxed text-ink-soft">{lead}</p>}
        </div>

        <div className="card-lift mt-8">{children}</div>

        {footer && <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>}
      </div>
    </div>
  );
}
