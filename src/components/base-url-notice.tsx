import { baseUrlKind } from "@/lib/site";

/**
 * Sagt dem Zusteller, wie weit sein QR-Code trägt.
 * Ein Code, der auf eine lokale Adresse zeigt, ist auf Papier wertlos –
 * das darf niemandem erst nach dem Druck auffallen.
 */
export function BaseUrlNotice({ url, context }: { url: string; context: "code" | "print" }) {
  const kind = baseUrlKind();
  if (kind === "public") return null;

  if (kind === "localhost") {
    return (
      <div className="rounded-2xl border border-coral-100 bg-coral-50 p-5">
        <p className="font-bold text-coral-600">
          Dieser QR-Code funktioniert nur auf diesem Rechner
        </p>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink">
          Er zeigt auf <span className="font-mono break-all">{url}</span>. Ein Handy kann
          diese Adresse nicht erreichen. Setze{" "}
          <span className="font-mono">NEXT_PUBLIC_BASE_URL</span> auf die öffentliche
          Adresse.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
      <p className="font-bold text-brand-900">Nur im lokalen Netzwerk erreichbar</p>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-brand-900/85">
        Der Code zeigt auf <span className="font-mono break-all">{url}</span>. Geräte im
        selben WLAN können ihn scannen – ideal zum Testen.{" "}
        {context === "print"
          ? "Zum Drucken brauchst du erst die öffentliche Adresse: NEXT_PUBLIC_BASE_URL setzen."
          : "Für gedruckte Karten muss NEXT_PUBLIC_BASE_URL gesetzt sein."}
      </p>
    </div>
  );
}
