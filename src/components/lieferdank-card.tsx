import { LogoMark } from "./logo";

type Props = {
  qrSvg: string;
  displayName: string;
  providerLabel: string | null;
  code: string;
};

/**
 * Die persönliche Lieferdank-Karte im Scheckkartenformat (85,6 × 54 mm).
 *
 * Alle Maße in Millimetern, damit der Ausdruck exakt stimmt.
 * Bewusst einseitig: Alles, was der Kunde braucht, steht vorne.
 */
export function LieferdankCard({ qrSvg, displayName, providerLabel, code }: Props) {
  return (
    <div
      className="flex flex-col overflow-hidden bg-white"
      style={{
        width: "85.6mm",
        height: "54mm",
        borderRadius: "3.2mm",
        border: "0.25mm solid #e7ecf4",
        padding: "3.4mm 4mm",
      }}
    >
      {/* Kopfzeile: Marke links, Nutzungshinweis rechts */}
      <div className="flex items-center justify-between">
        <span className="flex items-center" style={{ gap: "1.5mm" }}>
          <span
            className="shrink-0 [&>svg]:h-full [&>svg]:w-full"
            style={{ width: "5mm", height: "5mm" }}
          >
            <LogoMark />
          </span>
          <span className="font-extrabold tracking-tight" style={{ fontSize: "3.4mm" }}>
            <span className="text-brand-900">Liefer</span>
            <span className="text-coral">dank</span>
          </span>
        </span>

        <span
          className="font-bold text-ink-faint"
          style={{ fontSize: "1.9mm", letterSpacing: "0.09em" }}
        >
          KEINE APP NÖTIG
        </span>
      </div>

      {/* Hauptbereich: QR links, Ansprache rechts */}
      <div className="flex flex-1 items-center" style={{ gap: "3.6mm", marginTop: "2.6mm" }}>
        <div
          className="shrink-0 [&>svg]:h-full [&>svg]:w-full"
          style={{ width: "29mm", height: "29mm" }}
        >
          <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="font-extrabold text-brand-900"
            style={{ fontSize: "3.7mm", lineHeight: 1.22, textWrap: "balance" }}
          >
            Möchtest du Danke sagen? <span className="text-coral">❤</span>
          </p>

          <p
            className="truncate font-extrabold tracking-tight text-ink"
            style={{ fontSize: "5.4mm", lineHeight: 1.05, marginTop: "2.2mm" }}
          >
            {displayName}
          </p>

          {providerLabel && (
            <p
              className="truncate text-ink-soft"
              style={{ fontSize: "2.6mm", marginTop: "0.7mm" }}
            >
              unterwegs für {providerLabel}
            </p>
          )}
        </div>
      </div>

      {/* Fußzeile: die zwei Sätze, die jede Rückfrage vorwegnehmen */}
      <div
        style={{
          borderTop: "0.25mm solid #e7ecf4",
          paddingTop: "2mm",
          marginTop: "2mm",
        }}
        className="flex items-baseline justify-between"
      >
        <span className="text-ink-soft" style={{ fontSize: "2.2mm" }}>
          Danke sagen kostenlos · Trinkgeld freiwillig
        </span>
        <span
          className="font-mono font-semibold text-ink-faint"
          style={{ fontSize: "2.1mm", letterSpacing: "0.04em" }}
        >
          {code}
        </span>
      </div>
    </div>
  );
}
