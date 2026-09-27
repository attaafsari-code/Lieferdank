import Link from "next/link";
import { LogoMark } from "@/components/logo";

export const metadata = { title: "Offline", robots: { index: false, follow: false } };

/** Wird vom Service Worker gezeigt, wenn keine Verbindung besteht. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="h-12 w-12" />
      <h1 className="mt-7 text-2xl font-extrabold tracking-tight text-brand-900">Gerade keine Verbindung</h1>
      <p className="mt-3 max-w-xs leading-relaxed text-ink-soft">
        Danke sagen und bezahlen braucht Internet. Sobald du wieder online bist, geht es weiter.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Erneut versuchen
      </Link>
    </div>
  );
}
