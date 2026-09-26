import "server-only";
import QRCode from "qrcode";
import { baseUrl } from "./site";

/** Persönliche Danke-Seite als absolute URL. Hängt nur am Code, nie am Profil. */
export function thankYouUrl(code: string): string {
  return `${baseUrl()}/danke/${code}`;
}

/**
 * Hoher Kontrast (Dunkelblau auf Weiß) und Fehlerkorrektur „Q“ (25 %):
 * robust gegen Knicke, Kratzer und schlechtes Licht an der Haustür.
 */
const QR_OPTIONS = { errorCorrectionLevel: "Q" as const, color: { dark: "#0b2545", light: "#ffffff" } };

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...QR_OPTIONS, type: "svg", margin: 0 });
}

/** PNG mit Ruhezone (4 Module) – so erkennen es auch ältere Kamera-Apps sicher. */
export async function qrPngDataUrl(text: string, width = 1200): Promise<string> {
  return QRCode.toDataURL(text, { ...QR_OPTIONS, margin: 4, width });
}

export async function qrPngBuffer(text: string, width = 1200): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...QR_OPTIONS, margin: 4, width });
}

/** SVG mit Ruhezone für den Download. */
export async function qrSvgWithQuietZone(text: string): Promise<string> {
  return QRCode.toString(text, { ...QR_OPTIONS, type: "svg", margin: 4 });
}
