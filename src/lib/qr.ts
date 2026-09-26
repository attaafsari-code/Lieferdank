import "server-only";
import QRCode from "qrcode";
import { baseUrl } from "./site";

export { baseUrl };

/** Die persönliche Danke-Seite eines Zustellers als absolute URL. */
export function thankYouUrl(code: string): string {
  return `${baseUrl()}/danke/${code}`;
}

const QR_COLORS = { dark: "#0b2545", light: "#ffffff" } as const;

/** QR-Code als SVG -- skaliert verlustfrei für Bildschirm und Druck. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 0,
    color: QR_COLORS,
  });
}

/** QR-Code als PNG-Data-URL -- für Download und Weitergabe. */
export async function qrPngDataUrl(text: string, width = 1200): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "Q",
    margin: 2,
    width,
    color: QR_COLORS,
  });
}
