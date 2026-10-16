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
  { id: "classic", label: "Klassisch", description: "Weiß, QR-Code links" },
  { id: "brand", label: "Farbfläche", description: "Farbiger Hintergrund, QR-Code rechts" },
  { id: "personal", label: "Persönlich", description: "Foto oder Initialen im Fokus" },
];

export const CARD_COLORS: { id: CardColor; label: string; solid: string; light: string }[] = [
  { id: "blue", label: "Blau", solid: "#1a5ce0", light: "#ffffff" },
  { id: "navy", label: "Nachtblau", solid: "#173653", light: "#f0f4f8" },
  { id: "teal", label: "Petrol", solid: "#0c6963", light: "#effaf6" },
];
export function cardPalette(color?: CardColor) { return CARD_COLORS.find(item => item.id === color) ?? CARD_COLORS[0]; }

export type CardDesignFields = { layout: CardLayout; color?: CardColor; headline: string; showPhoto: boolean; showProvider: boolean };

export function defaultCardDesign(): CardDesignFields {
  return { layout: "classic", color: "blue", headline: DEFAULT_HEADLINE, showPhoto: false, showProvider: true };
}

export function isCardLayout(value: unknown): value is CardLayout {
  return CARD_LAYOUTS.some((layout) => layout.id === value);
}
