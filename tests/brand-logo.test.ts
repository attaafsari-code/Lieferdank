import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BRAND_MARK, BRAND_TAGLINE, BRAND_WORDMARK } from "@/lib/brand/logo-images";
import { renderCardSvg } from "@/lib/card/svg";

const ROOT = join(__dirname, "..");
const ORIGINAL = join(ROOT, "assets/brand/lieferdank-logo-original.png");
// Lage der Ausschnitte im Original, wie in scripts/brand/generate_brand_assets.py (inkl. 12 px Rand).
const CUTS = [
  { file: "public/brand/lieferdank-mark.png", left: 380, top: 35 },
  { file: "public/brand/lieferdank-wordmark.png", left: 161 - 12, top: 528 - 12 },
  { file: "public/brand/lieferdank-tagline.png", left: 429 - 12, top: 773 - 12 },
  { file: "apps/driver/assets/brand-wordmark.png", left: 161 - 12, top: 528 - 12 },
];

/** Bild über Weiß gelegt, als RGB-Rohdaten. */
async function overWhite(input: Buffer | string) {
  return sharp(input).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

describe("Original-Logo", () => {
  it("jede Logo-Datei ist ein unveränderter Ausschnitt des freigegebenen Originals", async () => {
    for (const cut of CUTS) {
      const asset = await overWhite(join(ROOT, cut.file));
      const { width, height } = asset.info;
      const original = await sharp(ORIGINAL).extract({ left: cut.left, top: cut.top, width, height }).removeAlpha().raw().toBuffer();
      const alpha = await sharp(join(ROOT, cut.file)).ensureAlpha().extractChannel(3).raw().toBuffer();
      let kept = 0, sum = 0, worst = 0;
      for (let p = 0; p < alpha.length; p++) {
        if (alpha[p] === 0) continue; // entfernter Hintergrund, angeschnittene Paketteile, ®
        kept++;
        for (let c = 0; c < 3; c++) { const d = Math.abs(original[p * 3 + c] - asset.data[p * 3 + c]); sum += d; worst = Math.max(worst, d); }
      }
      // Sichtbare Logopixel entsprechen dem Original bis auf Rundung der Hintergrundentfernung.
      expect(kept, cut.file).toBeGreaterThan(alpha.length * 0.15);
      expect(sum / (kept * 3), cut.file).toBeLessThan(1);
      expect(worst, cut.file).toBeLessThan(cut.file.includes("mark") ? 200 : 8);
    }
  });

  it("eingebettete Kartenlogos haben die Seitenverhältnisse des Originals", async () => {
    for (const [image, file] of [[BRAND_MARK, "public/brand/lieferdank-mark.png"], [BRAND_WORDMARK, "public/brand/lieferdank-wordmark.png"], [BRAND_TAGLINE, "public/brand/lieferdank-tagline.png"]] as const) {
      const meta = await sharp(Buffer.from(image.href.split(",")[1], "base64")).metadata();
      const full = await sharp(join(ROOT, file)).metadata();
      expect(Math.abs((meta.width! / meta.height!) / (full.width! / full.height!) - 1)).toBeLessThan(0.015);
      expect([image.width, image.height]).toEqual([full.width, full.height]);
    }
  });

  it("zeigt auf der Karte die Originalfarben, nicht das alte Markenblau der Nachzeichnung", async () => {
    const svg = renderCardSvg({ layout: "classic", headline: "Danke", publicName: "Max", providerLabel: null, code: "LD-TEST1", qrSvg: '<svg viewBox="0 0 1 1"></svg>', avatar: null });
    // Kartenkopf links oben (Logo-Bereich), gerastert mit ca. 300 dpi (1011 px Kartenbreite).
    const { data, info } = await sharp(Buffer.from(svg), { density: 600 }).resize(1011).extract({ left: 40, top: 30, width: 300, height: 60 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let originalBlue = 0, oldBrandBlue = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r < 20 && g > 50 && g < 90 && b > 110 && b < 160) originalBlue++; // Originalblau um #004288
      if (Math.abs(r - 0x1a) < 10 && Math.abs(g - 0x5c) < 10 && Math.abs(b - 0xe0) < 10) oldBrandBlue++;
    }
    expect(originalBlue).toBeGreaterThan(200);
    expect(oldBrandBlue).toBe(0);
  });

  it("enthält im Code keine nachgezeichnete Paket-Bildmarke mehr", () => {
    const legacy = /M13\.5 12 23\.5 7|M24 22\.5 35 17|PwaMark/;
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|svg|css)$/.test(name) && legacy.test(readFileSync(path, "utf8"))) hits.push(path);
      }
    };
    for (const dir of ["src", "apps/driver/src"]) walk(join(ROOT, dir));
    expect(hits).toEqual([]);
  });
});
