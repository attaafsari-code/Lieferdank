/**
 * Export der Karte im Browser: SVG-Datei, PNG in Druckauflösung.
 * Nur clientseitig nutzbar (fetch, Image, Canvas).
 */

import { CARD_HEIGHT_MM, CARD_WIDTH_MM } from "./design";

const FONT_URL = "/fonts/plus-jakarta-sans-latin.woff2";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Lädt eine Ressource der eigenen Seite als Data-URL (Foto, Schrift). */
export async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Konnte ${url} nicht laden`);
  return blobToDataUrl(await response.blob());
}

let fontCssCache: string | null = null;

/**
 * Bettet die Schrift ins SVG ein. Ein SVG als Bild darf keine externen Fonts
 * nachladen – ohne Einbettung fiele es auf eine Systemschrift zurück.
 */
export async function embeddedFontCss(): Promise<string> {
  if (fontCssCache) return fontCssCache;
  const dataUrl = await urlToDataUrl(FONT_URL);
  fontCssCache = `@font-face{font-family:'Plus Jakarta Sans';font-weight:200 800;src:url(${dataUrl}) format('woff2');}`;
  return fontCssCache;
}

/** Rendert ein SVG in ein PNG. 600 dpi reichen für scharfen Druck. */
export async function svgToPngBlob(svg: string, dpi = 600): Promise<Blob> {
  const width = Math.round((CARD_WIDTH_MM / 25.4) * dpi);
  const height = Math.round((CARD_HEIGHT_MM / 25.4) * dpi);

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("SVG konnte nicht gerendert werden"));
      image.src = url;
    });
    // Schriften im SVG brauchen einen Moment, bis sie dekodiert sind.
    await new Promise((resolve) => setTimeout(resolve, 60));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas nicht verfügbar");
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG-Export fehlgeschlagen"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
