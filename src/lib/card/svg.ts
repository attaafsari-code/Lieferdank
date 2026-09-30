import type { CardLayout } from "../db/types";
import { CARD_HEIGHT_MM, CARD_WIDTH_MM } from "./design";

/**
 * Rendert die Lieferdank-Karte als eigenständiges SVG.
 *
 * Eine einzige Quelle für Vorschau, SVG-Download, PNG-Export und Druck.
 * Alle Koordinaten sind Millimeter (viewBox 85,6 × 54), damit der Ausdruck
 * exakt Scheckkartengröße hat. Keine CSS-Variablen, keine externen Referenzen
 * außer optional dem Foto – das SVG muss auch außerhalb der Seite funktionieren.
 *
 * Reine Funktion ohne DOM- oder Server-Abhängigkeit.
 */

export type CardRenderInput = {
  layout: CardLayout;
  headline: string;
  publicName: string;
  /** null = ausblenden. */
  providerLabel: string | null;
  code: string;
  /** Vollständiges SVG aus der qrcode-Bibliothek (margin 0). */
  qrSvg: string;
  /** null = kein Avatar. href null = Initialen statt Foto. */
  avatar: { href: string | null; initials: string } | null;
  /** Eingebettete @font-face-Regel für Exporte, damit die Schrift überall stimmt. */
  embeddedFontCss?: string;
  /** Eindeutiges Präfix für IDs, wenn mehrere Karten auf einer Seite stehen. */
  idPrefix?: string;
};

const W = CARD_WIDTH_MM;
const H = CARD_HEIGHT_MM;
const PAD = 4;

const COLORS = {
  ink: "#0d1b2f",
  inkSoft: "#56688a",
  inkFaint: "#8798b3",
  line: "#e7ecf4",
  brand: "#1a5ce0",
  brand400: "#4b8ef0",
  brand50: "#edf4ff",
  brand900: "#0b2545",
  coral: "#ff4d4a",
  white: "#ffffff",
};

const SANS =
  "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/* ---------- Hilfsfunktionen ---------- */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Grober Zeilenumbruch. SVG kennt keinen automatischen Umbruch, also wird die
 * Zeichenbreite geschätzt (Plus Jakarta Sans: ~0,56 em, fett ~0,6 em).
 */
export function wrapText(text: string, fontSize: number, maxWidth: number, maxLines: number, bold = true): string[] {
  const charWidth = fontSize * (bold ? 0.6 : 0.56);
  const maxChars = Math.max(4, Math.floor(maxWidth / charWidth));
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
    return kept;
  }
  return lines;
}

/** Schriftgröße so weit verkleinern, dass ein Name in eine Zeile passt. */
function fitFontSize(text: string, base: number, maxWidth: number, min: number): number {
  const needed = text.length * base * 0.6;
  if (needed <= maxWidth) return base;
  return Math.max(min, round((maxWidth / (text.length * 0.6)) * 0.98));
}

/** Herz im Text farbig darstellen, unabhängig davon, ob es mit oder ohne Variation Selector kommt. */
function textWithHeart(text: string, heartColor: string): string {
  return escapeXml(text.replace(/️/g, "")).replace(
    /❤/g,
    `<tspan fill="${heartColor}">❤</tspan>`,
  );
}

function embedQr(qrSvg: string, x: number, y: number, size: number): string {
  const viewBox = qrSvg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 33 33";
  const inner = qrSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${viewBox}" shape-rendering="crispEdges">${inner}</svg>`;
}

function logoMark(x: number, y: number, size: number, onDark: boolean): string {
  const lines = onDark ? "rgba(255,255,255,0.6)" : COLORS.brand400;
  const box = onDark ? COLORS.white : COLORS.brand900;
  const inner = onDark ? "rgba(255,255,255,0.75)" : COLORS.brand;
  const heartStroke = onDark ? COLORS.brand : COLORS.white;
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 40 40">
<g stroke="${lines}" stroke-width="2.6" stroke-linecap="round"><line x1="2" y1="12.5" x2="9" y2="12.5"/><line x1="1" y1="19.5" x2="7" y2="19.5"/><line x1="3" y1="26.5" x2="9" y2="26.5"/></g>
<path d="M13.5 11.5 23.5 6.5l10 5v12l-10 5-10-5z" fill="none" stroke="${box}" stroke-width="2.8" stroke-linejoin="round"/>
<path d="M13.5 11.5 23.5 16.5l10-5M23.5 16.5v12" fill="none" stroke="${inner}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M24.6 27.6c0-2.1 1.7-3.6 3.5-3.6 1.05 0 2 .5 2.55 1.3.55-.8 1.5-1.3 2.55-1.3 1.8 0 3.5 1.5 3.5 3.6 0 3.2-4.35 5.95-6.05 7-1.7-1.05-6.05-3.8-6.05-7z" fill="${COLORS.coral}" stroke="${heartStroke}" stroke-width="2.2"/>
</svg>`;
}

function wordmark(x: number, baseline: number, size: number, onDark: boolean): string {
  const liefer = onDark ? COLORS.white : COLORS.brand900;
  const dank = COLORS.coral;
  return `<text x="${x}" y="${baseline}" font-family="${SANS}" font-size="${size}" font-weight="800" letter-spacing="-0.08"><tspan fill="${liefer}">Liefer</tspan><tspan fill="${dank}">dank</tspan></text>`;
}

function avatar(
  input: NonNullable<CardRenderInput["avatar"]>,
  cx: number,
  cy: number,
  r: number,
  onDark: boolean,
  id: string,
): string {
  const ring = onDark ? "rgba(255,255,255,0.85)" : COLORS.white;
  if (input.href) {
    return `<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
<circle cx="${cx}" cy="${cy}" r="${r + 0.35}" fill="${ring}"/>
<image href="${escapeXml(input.href)}" x="${round(cx - r)}" y="${round(cy - r)}" width="${round(r * 2)}" height="${round(r * 2)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
  }
  const fill = onDark ? "rgba(255,255,255,0.18)" : COLORS.brand50;
  const text = onDark ? COLORS.white : COLORS.brand;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
<text x="${cx}" y="${round(cy + r * 0.34)}" text-anchor="middle" font-family="${SANS}" font-size="${round(r * 0.95)}" font-weight="800" fill="${text}">${escapeXml(input.initials)}</text>`;
}

function footer(code: string, onDark: boolean): string {
  const line = onDark ? "rgba(255,255,255,0.25)" : COLORS.line;
  const text = onDark ? "rgba(255,255,255,0.8)" : COLORS.inkSoft;
  const faint = onDark ? "rgba(255,255,255,0.6)" : COLORS.inkFaint;
  return `<line x1="${PAD}" y1="45" x2="${W - PAD}" y2="45" stroke="${line}" stroke-width="0.25"/>
<text x="${PAD}" y="49.6" font-family="${SANS}" font-size="2.1" fill="${text}">Danke sagen kostenlos · Trinkgeld freiwillig</text>
<text x="${W - PAD}" y="49.6" text-anchor="end" font-family="${MONO}" font-size="2" font-weight="600" letter-spacing="0.1" fill="${faint}">${escapeXml(code)}</text>`;
}

function header(onDark: boolean): string {
  const hint = onDark ? "rgba(255,255,255,0.7)" : COLORS.inkFaint;
  return `${logoMark(PAD, 3.4, 5, onDark)}
${wordmark(PAD + 6, 7.3, 3.3, onDark)}
<text x="${W - PAD}" y="6.9" text-anchor="end" font-family="${SANS}" font-size="1.85" font-weight="700" letter-spacing="0.16" fill="${hint}">KEINE APP NÖTIG</text>`;
}

function qrCaption(cx: number, y: number, onDark: boolean): string {
  const fill = onDark ? "rgba(255,255,255,0.85)" : COLORS.inkSoft;
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="1.8" font-weight="700" letter-spacing="0.12" fill="${fill}">QR SCANNEN &amp; DANKE SAGEN</text>`;
}

/** Textblock: Überschrift, Name, Anbieter – vertikal zentriert im Bereich top..bottom. */
function textBlock(opts: {
  x: number;
  width: number;
  top: number;
  bottom: number;
  headline: string;
  name: string;
  provider: string | null;
  headlineLines: number;
  onDark: boolean;
  headlineFirst: boolean;
}): string {
  const headlineSize = 3.2;
  const headlineLeading = 4;
  const nameBase = 5;
  const providerSize = 2.4;

  const lines = opts.headline.trim() ? wrapText(opts.headline, headlineSize, opts.width, opts.headlineLines) : [];
  const nameSize = fitFontSize(opts.name, nameBase, opts.width, 3.2);

  const headlineHeight = lines.length ? (lines.length - 1) * headlineLeading + headlineSize : 0;
  const nameHeight = nameSize;
  const providerHeight = opts.provider ? providerSize + 1.2 : 0;
  const gap = lines.length ? 2.6 : 0;
  const total = headlineHeight + gap + nameHeight + providerHeight;
  let y = opts.top + (opts.bottom - opts.top - total) / 2;

  const colors = opts.onDark
    ? { headline: COLORS.white, name: COLORS.white, provider: "rgba(255,255,255,0.78)", heart: COLORS.coral }
    : { headline: COLORS.brand900, name: COLORS.ink, provider: COLORS.inkSoft, heart: COLORS.coral };

  const parts: string[] = [];
  const renderHeadline = () => {
    lines.forEach((line, index) => {
      const baseline = round(y + headlineSize * 0.82 + index * headlineLeading);
      parts.push(
        `<text x="${opts.x}" y="${baseline}" font-family="${SANS}" font-size="${headlineSize}" font-weight="800" fill="${colors.headline}">${textWithHeart(line, colors.heart)}</text>`,
      );
    });
    y += headlineHeight + gap;
  };
  const renderName = () => {
    parts.push(
      `<text x="${opts.x}" y="${round(y + nameSize * 0.8)}" font-family="${SANS}" font-size="${nameSize}" font-weight="800" letter-spacing="-0.1" fill="${colors.name}">${escapeXml(opts.name)}</text>`,
    );
    y += nameHeight;
    if (opts.provider) {
      parts.push(
        `<text x="${opts.x}" y="${round(y + 1.2 + providerSize * 0.8)}" font-family="${SANS}" font-size="${providerSize}" fill="${colors.provider}">unterwegs für ${escapeXml(opts.provider)}</text>`,
      );
      y += providerHeight;
    }
  };

  if (opts.headlineFirst) {
    renderHeadline();
    renderName();
  } else {
    renderName();
    y += gap;
    renderHeadline();
  }
  return parts.join("\n");
}

/* ---------- Layouts ---------- */

function classic(input: CardRenderInput, id: string): string {
  const qrSize = 28;
  const qrX = PAD;
  const qrY = 10;
  const colX = qrX + qrSize + 4;
  const colWidth = W - PAD - colX;
  let content = "";
  let top = 10;

  if (input.avatar) {
    content += avatar(input.avatar, colX + 4.4, 14.6, 4.4, false, `${id}-av`);
    top = 20.5;
  }

  content += textBlock({
    x: colX,
    width: colWidth,
    top,
    bottom: 42,
    headline: input.headline,
    name: input.publicName,
    provider: input.providerLabel,
    headlineLines: input.avatar ? 2 : 3,
    onDark: false,
    headlineFirst: true,
  });

  return `<rect x="0.125" y="0.125" width="${W - 0.25}" height="${H - 0.25}" rx="3.2" fill="${COLORS.white}" stroke="${COLORS.line}" stroke-width="0.25"/>
${header(false)}
${embedQr(input.qrSvg, qrX, qrY, qrSize)}
${qrCaption(qrX + qrSize / 2, 41.6, false)}
${content}
${footer(input.code, false)}`;
}

function brand(input: CardRenderInput, id: string): string {
  const tile = 29;
  const tileX = W - PAD - tile;
  const tileY = 9.5;
  const qrPad = 2.5;
  const colX = PAD;
  const colWidth = tileX - 4 - colX;
  let content = "";
  let top = 10;

  if (input.avatar) {
    content += avatar(input.avatar, colX + 4.4, 14.6, 4.4, true, `${id}-av`);
    top = 20.5;
  }

  content += textBlock({
    x: colX,
    width: colWidth,
    top,
    bottom: 42,
    headline: input.headline,
    name: input.publicName,
    provider: input.providerLabel,
    headlineLines: input.avatar ? 2 : 3,
    onDark: true,
    headlineFirst: true,
  });

  return `<rect width="${W}" height="${H}" rx="3.2" fill="${COLORS.brand}"/>
${header(true)}
<rect x="${tileX}" y="${tileY}" width="${tile}" height="${tile}" rx="2.2" fill="${COLORS.white}"/>
${embedQr(input.qrSvg, tileX + qrPad, tileY + qrPad, tile - qrPad * 2)}
${qrCaption(tileX + tile / 2, 41.6, true)}
${content}
${footer(input.code, true)}`;
}

function personal(input: CardRenderInput, id: string): string {
  const qrSize = 28;
  const qrX = W - PAD - qrSize;
  const qrY = 10;
  const colWidth = qrX - 4 - PAD;
  const avatarInput = input.avatar ?? { href: null, initials: "" };
  const r = 7;
  const cx = PAD + r;
  const cy = 18.5;

  const nameX = PAD + r * 2 + 3;
  const nameWidth = qrX - 3 - nameX;
  const nameSize = fitFontSize(input.publicName, 4.6, nameWidth, 3);
  const nameBaseline = input.providerLabel ? 18.4 : 20;

  const headlineLines = wrapText(input.headline, 3, colWidth, 2);

  return `<rect x="0.125" y="0.125" width="${W - 0.25}" height="${H - 0.25}" rx="3.2" fill="${COLORS.white}" stroke="${COLORS.line}" stroke-width="0.25"/>
${header(false)}
${avatar(input.avatar ? avatarInput : { href: null, initials: avatarInput.initials || "?" }, cx, cy, r, false, `${id}-av`)}
<text x="${nameX}" y="${nameBaseline}" font-family="${SANS}" font-size="${nameSize}" font-weight="800" letter-spacing="-0.1" fill="${COLORS.ink}">${escapeXml(input.publicName)}</text>
${
  input.providerLabel
    ? `<text x="${nameX}" y="${round(nameBaseline + 3.6)}" font-family="${SANS}" font-size="2.3" fill="${COLORS.inkSoft}">unterwegs für ${escapeXml(input.providerLabel)}</text>`
    : ""
}
${headlineLines
  .map(
    (line, index) =>
      `<text x="${PAD}" y="${round(33 + index * 3.8)}" font-family="${SANS}" font-size="3" font-weight="800" fill="${COLORS.brand900}">${textWithHeart(line, COLORS.coral)}</text>`,
  )
  .join("\n")}
${embedQr(input.qrSvg, qrX, qrY, qrSize)}
${qrCaption(qrX + qrSize / 2, 41.6, false)}
${footer(input.code, false)}`;
}

export function renderCardSvg(input: CardRenderInput): string {
  const id = input.idPrefix ?? "ld";
  const body =
    input.layout === "brand" ? brand(input, id) : input.layout === "personal" ? personal(input, id) : classic(input, id);
  const style = input.embeddedFontCss ? `<style>${input.embeddedFontCss}</style>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" role="img" aria-label="Lieferdank-Karte von ${escapeXml(input.publicName)}">${style}
${body}
</svg>`;
}
