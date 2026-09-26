import type { CardDesign, CardLayout } from "../db/types";

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
  { id: "brand", label: "Blau", description: "Markenfarbe, QR-Code rechts" },
  { id: "personal", label: "Persönlich", description: "Foto oder Initialen im Fokus" },
];

export type CardDesignFields = Pick<CardDesign, "layout" | "headline" | "showPhoto" | "showProvider">;

export function defaultCardDesign(): CardDesignFields {
  return { layout: "classic", headline: DEFAULT_HEADLINE, showPhoto: false, showProvider: true };
}

export function isCardLayout(value: unknown): value is CardLayout {
  return CARD_LAYOUTS.some((layout) => layout.id === value);
}
