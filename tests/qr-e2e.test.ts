import jsQR from "jsqr";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { qrPngBuffer, thankYouUrl } from "@/server/qr";

/**
 * QR-End-to-End: Der erzeugte Code wird wie von einer Kamera zurückgelesen.
 * Geprüft wird, dass exakt die persönliche Danke-Seite herauskommt.
 */
function decode(png: Buffer): string | null {
  const image = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data ?? null;
}

afterEach(() => vi.unstubAllEnvs());

describe("QR-Code Ende-zu-Ende", () => {
  it("führt in Produktion auf https://lieferdank.de/danke/[CODE]", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://lieferdank.de");
    const url = thankYouUrl("LD-84K2P");
    expect(url).toBe("https://lieferdank.de/danke/LD-84K2P");
    expect(decode(await qrPngBuffer(url))).toBe(url);
  });

  it("ist in Kartengröße (28 mm bei 300 dpi) noch lesbar", async () => {
    const url = "https://lieferdank.de/danke/LD-84K2P7WQ9A";
    // 28 mm ≈ 331 px bei 300 dpi; der weiße Kartenrand ergibt die Ruhezone.
    const png = await QRCode.toBuffer(url, { errorCorrectionLevel: "Q", margin: 2, width: 331, color: { dark: "#0b2545", light: "#ffffff" } });
    expect(decode(png)).toBe(url);
  });

  it("hat genug Kontrast (Dunkelblau auf Weiß)", async () => {
    const png = PNG.sync.read(await qrPngBuffer("https://lieferdank.de/danke/LD-DEMO01", 400));
    const colors = new Set<string>();
    for (let i = 0; i < png.data.length; i += 4) colors.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`);
    expect(colors.has("255,255,255")).toBe(true);
    expect(colors.has("11,37,69")).toBe(true);
  });

  it("verwendet niemals localhost, wenn in Produktion eine falsche Adresse gesetzt ist", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000");
    expect(thankYouUrl("LD-84K2P")).toBe("https://lieferdank.de/danke/LD-84K2P");
  });
});
