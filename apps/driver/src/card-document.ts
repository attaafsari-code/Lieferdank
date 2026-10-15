/** Same owner-authorized SVG as the web export, kept as vector artwork on A4 paper. */
export function cardDocument(svg: string): string {
  if (!/^\s*<svg\b/i.test(svg) || /<\s*(script|iframe|foreignObject)\b|\son\w+\s*=/i.test(svg)) throw new Error("Die Kartendatei konnte nicht sicher geladen werden.");
  for (const match of svg.matchAll(/(?:href|xlink:href)\s*=\s*["']([^"']*)["']/gi)) {
    if (!/^(#|data:image\/(png|jpeg|webp);base64,)/i.test(match[1])) throw new Error("Die Karte enthält eine nicht unterstützte Bildquelle.");
  }
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>LieferDank-Karte</title><style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:white}.card{margin:20mm auto 0;width:85.6mm;height:54mm;break-inside:avoid}.card svg{width:100%;height:100%;display:block}</style></head><body><div class="card">${svg}</div></body></html>`;
}
export const CARD_PAPER = { width: 595.276, height: 841.89 };

/** Expo's iOS print dialog rejects this code when the user closes it without printing. */
export function printWasCancelled(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ERR_PRINT_INCOMPLETE";
}
