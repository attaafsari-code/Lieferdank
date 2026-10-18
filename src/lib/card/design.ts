import { RANKS, type RankColor } from "../ranks";
/** Pure shared card contract: usable in web, native app and persisted designs. */
export type CardLayout = "classic" | "brand" | "personal";
export type CardColor = "blue" | "navy" | "teal" | RankColor;

/** Scheckkartenformat (ISO/IEC 7810 ID-1), in Millimetern. */
export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 54;

export const DEFAULT_HEADLINE = "Danke für deine Wertschätzung ❤";
export const MAX_HEADLINE_LENGTH = 60;

export const HEADLINE_PRESETS = [
  "Danke für deine Wertschätzung ❤",
  "QR scannen & Danke sagen",
  "Möchtest du Danke sagen? ❤",
  "Danke, dass ich dir heute dein Paket bringen durfte.",
  "Danke, dass ich dir dein Essen bringen durfte.",
];

export const CARD_LAYOUTS: { id: CardLayout; label: string; description: string }[] = [
  { id: "classic", label: "Klassisch", description: "Heller Hintergrund, QR-Code links" },
  { id: "brand", label: "Farbfläche", description: "Farbiger Hintergrund, QR-Code rechts" },
  { id: "personal", label: "Persönlich", description: "Foto oder Initialen im Fokus" },
];

type Palette = { id: CardColor; label: string; lightLabel: string; solid: string; light: string; accent?: string; darkInk?: boolean };
export const CARD_COLORS: Palette[] = [
  { id: "blue", label: "Blau", lightLabel: "Weiß", solid: "#1a5ce0", light: "#ffffff" },
  { id: "navy", label: "Nachtblau", lightLabel: "Hellblaugrau", solid: "#173653", light: "#f0f4f8" },
  { id: "teal", label: "Petrol", lightLabel: "Hellpetrol", solid: "#0c6963", light: "#effaf6" },
];
export const RANK_CARD_COLORS: (Palette & { requiredThanks: number })[] = RANKS.filter(rank => rank.id !== "start").map(rank => ({
  id: rank.id as RankColor, label: rank.id === "diamond" ? "Diamant · Eisblau" : rank.id === "legend" ? "Legende · Königsviolett" : rank.label,
  lightLabel: `${rank.label} · hell`, solid: rank.cardSolid, light: rank.light, requiredThanks: rank.threshold,
  ...(rank.id === "legend" ? { accent: rank.accent } : {}), ...(rank.id === "diamond" ? { darkInk: true } : {}),
}));
export function cardPalette(color?: CardColor): Palette { return [...CARD_COLORS, ...RANK_CARD_COLORS].find(item => item.id === color) ?? CARD_COLORS[0]; }
export function isCardColor(value: unknown): value is CardColor { return [...CARD_COLORS, ...RANK_CARD_COLORS].some(item => item.id === value); }
export function rankColorOptions(layout: CardLayout) {
  return RANK_CARD_COLORS.map(option => ({ id: option.id, label: layout === "brand" ? option.label : option.lightLabel,
    background: cardBackgroundColor(layout, option.id), requiredThanks: option.requiredThanks }));
}

/** Only the background changes; layout-specific text and fixed brand accents do not. */
export function cardBackgroundColor(layout: CardLayout, color?: CardColor): string {
  const palette = cardPalette(color);
  return layout === "brand" ? palette.solid : palette.light;
}

/** One presentation contract for web and native: name and swatch match the rendered surface. */
export function cardColorSelection(layout: CardLayout) {
  const solid = layout === "brand";
  return {
    label: "Hintergrundfarbe",
    hint: solid ? "Kräftige Farbe auf der gesamten Kartenfläche." : "Dezente, helle Hintergründe. Für kräftige Farben wähle das Layout „Farbfläche“.",
    options: CARD_COLORS.map(option => ({ id: option.id, label: solid ? option.label : option.lightLabel, background: cardBackgroundColor(layout, option.id) })),
  };
}

export type CardDesignFields = { layout: CardLayout; color?: CardColor; headline: string; showPhoto: boolean; showProvider: boolean };

export function defaultCardDesign(): CardDesignFields {
  return { layout: "classic", color: "blue", headline: DEFAULT_HEADLINE, showPhoto: false, showProvider: true };
}

export function isCardLayout(value: unknown): value is CardLayout {
  return CARD_LAYOUTS.some((layout) => layout.id === value);
}
