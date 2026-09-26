import Link from "next/link";
import { LogoMark } from "@/components/logo";

export const metadata = { title: "Seite nicht gefunden" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <LogoMark className="h-12 w-12" />
      <h1 className="mt-7 text-3xl font-extrabold tracking-tight text-brand-900">
        Seite nicht gefunden
      </h1>
      <p className="mt-3 max-w-sm leading-relaxed text-ink-soft">
        Diese Seite gibt es nicht. Wenn du einen Danke-Code gescannt hast, prüfe bitte, ob
        der QR-Code vollständig erfasst wurde.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Zur Startseite
      </Link>
    </div>
  );
}
