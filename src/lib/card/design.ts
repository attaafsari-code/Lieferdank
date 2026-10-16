/** Pure shared card contract: usable in web, native app and persisted designs. */
export type CardLayout = "classic" | "brand" | "personal";
export type CardColor = "blue" | "navy" | "teal";

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

export const CARD_COLORS: { id: CardColor; label: string; lightLabel: string; solid: string; light: string }[] = [
  { id: "blue", label: "Blau", lightLabel: "Weiß", solid: "#1a5ce0", light: "#ffffff" },
  { id: "navy", label: "Nachtblau", lightLabel: "Hellblaugrau", solid: "#173653", light: "#f0f4f8" },
  { id: "teal", label: "Petrol", lightLabel: "Hellpetrol", solid: "#0c6963", light: "#effaf6" },
];
export function cardPalette(color?: CardColor) { return CARD_COLORS.find(item => item.id === color) ?? CARD_COLORS[0]; }

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
