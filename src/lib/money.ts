/**
 * Geldlogik von Lieferdank.
 *
 *  - Der Kunde zahlt EXAKT den gewählten Betrag. Keine Aufschläge im Checkout.
 *  - Application Fees: 2 € → 0,50 €, 3 € → 0,60 €, 5 € → 1,00 €.
 *  - Stripe belastet den Connected Account separat mit seinen Kosten.
 *
 * Alle Beträge sind Integer in Cent. Niemals Floats für Geld.
 */

export const CURRENCY = "EUR";

/** Feste Trinkgeld-Buttons. */
export const TIP_OPTIONS_CENTS = [200, 300, 500] as const;

export const MIN_TIP_CENTS = 200;
export const MAX_TIP_CENTS = 500;

export const APPLICATION_FEE_CENTS: Readonly<Record<200 | 300 | 500, number>> = {
  200: 50,
  300: 60,
  500: 100,
};

export type TipSplit = {
  grossCents: number;
  driverCents: number;
  platformGrossFeeCents: number;
  paymentProviderFeeCents: number;
  /** Historische DB-Spalte; Stripe belastet das Connected Account direkt. */
  payoutFeeCents: number;
  platformNetRevenueCents: number;
};

export function splitTip(grossCents: number): TipSplit {
  if (!isAllowedTipAmount(grossCents)) throw new Error("Trinkgeldbetrag nicht erlaubt");
  const platformGrossFeeCents = APPLICATION_FEE_CENTS[grossCents as 200 | 300 | 500];
  // Bei Direct Charges zahlt der Connected Account Stripe direkt. Diese Kosten
  // sind keine Lieferdank-Kosten und werden nicht als Lieferdank-Marge verbucht.
  const paymentProviderFeeCents = 0;
  return {
    grossCents,
    driverCents: grossCents - platformGrossFeeCents,
    platformGrossFeeCents,
    paymentProviderFeeCents,
    payoutFeeCents: 0,
    platformNetRevenueCents: platformGrossFeeCents - paymentProviderFeeCents,
  };
}

export function isAllowedTipAmount(grossCents: number): boolean {
  return TIP_OPTIONS_CENTS.some((amount) => amount === grossCents);
}
