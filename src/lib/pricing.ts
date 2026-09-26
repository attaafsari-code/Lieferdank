import type { CardProduct } from "./db/types";

/**
 * Preise für physische Karten.
 *
 * Im Testbetrieb sind Bestellungen kostenlos (CARD_ORDERS_PAID nicht gesetzt).
 * Die Preislogik ist trotzdem vollständig, damit das Umschalten später nur eine
 * Umgebungsvariable ist.
 */

export const CARD_PRICES_CENTS: Record<CardProduct, number> = {
  standard: 490,
  personalized: 690,
};

export const CARD_QUANTITIES = [1, 3, 5] as const;

/** Rabatt in Prozent je Stückzahl (Bundle). */
const BUNDLE_DISCOUNT_PERCENT: Record<number, number> = { 1: 0, 3: 10, 5: 20 };

export const CARD_PRODUCT_LABELS: Record<CardProduct, string> = {
  standard: "Lieferdank-Karte",
  personalized: "Persönliche Lieferdank-Karte",
};

export function cardOrdersArePaid(): boolean {
  return typeof process !== "undefined" && process.env?.CARD_ORDERS_PAID === "true";
}

export type CardQuote = {
  product: CardProduct;
  quantity: number;
  unitPriceCents: number;
  discountPercent: number;
  totalCents: number;
  free: boolean;
};

export function quoteCardOrder(product: CardProduct, quantity: number, paid = cardOrdersArePaid()): CardQuote {
  const discountPercent = BUNDLE_DISCOUNT_PERCENT[quantity] ?? 0;
  const listPrice = CARD_PRICES_CENTS[product];
  const unitPriceCents = Math.round((listPrice * (100 - discountPercent)) / 100);

  if (!paid) {
    return { product, quantity, unitPriceCents: 0, discountPercent: 0, totalCents: 0, free: true };
  }
  return {
    product,
    quantity,
    unitPriceCents,
    discountPercent,
    totalCents: unitPriceCents * quantity,
    free: false,
  };
}

/** Eine Karte gilt als persönlich, sobald eigener Text oder ein Foto darauf ist. */
export function cardProductFor(design: { headline: string; showPhoto: boolean }, defaultHeadline: string): CardProduct {
  return design.showPhoto || design.headline.trim() !== defaultHeadline ? "personalized" : "standard";
}
