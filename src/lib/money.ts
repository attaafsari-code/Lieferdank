/**
 * Geldlogik von Lieferdank.
 *
 * Grundregeln (Master-Prompt §70–§77):
 *  - Der Kunde zahlt EXAKT den gewaehlten Betrag. Keine Aufschlaege im Checkout.
 *  - Pro Trinkgeldzahlung behaelt die Plattform brutto 0,50 EUR ein.
 *  - Diese 0,50 EUR sind NICHT der Gewinn. Davon gehen Payment-Kosten ab.
 *
 * Alle Betraege sind Integer in Cent. Niemals Floats fuer Geld.
 */

export const CURRENCY = "EUR";

/** Feste Trinkgeld-Buttons. */
export const TIP_OPTIONS_CENTS = [200, 300, 500] as const;

/**
 * Untergrenze fuer frei gewaehlte Betraege.
 *
 * Bewusst 2 EUR: Bei 1 EUR waere die feste Plattformgebuehr von 0,50 EUR
 * die Haelfte des Trinkgelds. Das widerspricht der Markenaussage, dass der
 * Zusteller im Mittelpunkt steht -- also gibt es diesen Betrag gar nicht erst.
 */
export const MIN_TIP_CENTS = 200;
export const MAX_TIP_CENTS = 5000;

/** Brutto-Plattformgebuehr pro Zahlung (§71). */
export const PLATFORM_GROSS_FEE_CENTS = 50;

/**
 * Geschaetzte Kosten des Payment-Providers.
 * Default = Stripe DE Karten (1,5 % + 0,25 EUR). Ueber ENV anpassbar,
 * damit ein Providerwechsel keine Codeaenderung braucht (§74).
 */
export const PROVIDER_FEE_PERCENT = Number(process.env.PAYMENT_FEE_PERCENT ?? "1.5");
export const PROVIDER_FEE_FIXED_CENTS = Number(process.env.PAYMENT_FEE_FIXED_CENTS ?? "25");

export type TipSplit = {
  /** Was der Kunde zahlt. */
  grossCents: number;
  /** Was dem Zusteller gutgeschrieben wird. */
  driverCents: number;
  /** Brutto-Plattformgebuehr (vor Payment-Kosten). */
  platformGrossFeeCents: number;
  /** Geschaetzte Payment-Provider-Kosten. */
  paymentProviderFeeCents: number;
  /** Geschaetzte tatsaechliche Lieferdank-Marge (§72). */
  platformNetRevenueCents: number;
};

/** Rundet kaufmaennisch auf ganze Cent. */
function roundCents(value: number): number {
  return Math.round(value);
}

export function estimateProviderFeeCents(grossCents: number): number {
  return roundCents((grossCents * PROVIDER_FEE_PERCENT) / 100 + PROVIDER_FEE_FIXED_CENTS);
}

/**
 * Teilt eine Trinkgeldzahlung auf.
 * Sicherheitsnetz: bei Kleinstbetraegen darf der Zusteller nie negativ werden.
 */
export function splitTip(grossCents: number): TipSplit {
  if (!Number.isInteger(grossCents) || grossCents <= 0) {
    throw new Error("splitTip: grossCents muss ein positiver Integer sein");
  }
  const platformGrossFeeCents = Math.min(PLATFORM_GROSS_FEE_CENTS, grossCents);
  const driverCents = grossCents - platformGrossFeeCents;
  const paymentProviderFeeCents = estimateProviderFeeCents(grossCents);
  return {
    grossCents,
    driverCents,
    platformGrossFeeCents,
    paymentProviderFeeCents,
    platformNetRevenueCents: platformGrossFeeCents - paymentProviderFeeCents,
  };
}

export function isAllowedTipAmount(grossCents: number): boolean {
  return (
    Number.isInteger(grossCents) && grossCents >= MIN_TIP_CENTS && grossCents <= MAX_TIP_CENTS
  );
}
