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

/**
 * Anteil der Lieferdank-Gebühr, der bei einem insgesamt erstatteten Betrag zurückzugeben ist.
 * Vollständig erstattet → die ganze Gebühr. Sonst anteilig, auf ganze Cent abgerundet –
 * so gibt Lieferdank nie mehr zurück, als dem erstatteten Anteil entspricht, und rundet
 * auch dann nicht über Stripes eigene anteilige Rückgabe hinaus.
 */
export function proportionalFeeRefundCents(feeCents: number, amountCents: number, refundedCents: number): number {
  if (amountCents <= 0 || refundedCents <= 0) return 0;
  if (refundedCents >= amountCents) return feeCents;
  return Math.floor((feeCents * refundedCents) / amountCents);
}

type RefundableTip = {
  grossCents: number;
  driverCents: number;
  platformGrossFeeCents: number;
  refundedCents?: number;
  feeRefundedCents?: number;
};

/**
 * Was von einem Trinkgeld nach Erstattungen tatsächlich bleibt. Der Kunde bekommt den
 * erstatteten Betrag aus dem Stripe-Guthaben des Zustellers; Lieferdank gibt seinen Anteil
 * daran über die Gebühr zurück. Der Zusteller trägt also „erstattet minus zurückgegebene Gebühr“.
 */
export function effectiveTip(tip: RefundableTip): { grossCents: number; driverCents: number; platformFeeCents: number } {
  const refunded = tip.refundedCents ?? 0;
  const feeRefunded = tip.feeRefundedCents ?? 0;
  return {
    grossCents: tip.grossCents - refunded,
    driverCents: tip.driverCents - (refunded - feeRefunded),
    platformFeeCents: tip.platformGrossFeeCents - feeRefunded,
  };
}

/** „1,50“, „1.5“, „2“ oder „2 €“ → Cent. Alles Uneindeutige ergibt null. */
export function parseEuroToCents(input: string): number | null {
  const match = input.trim().replace(/\s*€$/, "").match(/^(\d{1,6})(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/**
 * Was eine weitere Erstattung von amountCents bewirkt – für die Zusammenfassung vor der
 * Bestätigung. Rechnet mit derselben Regel wie der Abgleich.
 */
export function refundPreview(tip: RefundableTip, amountCents: number) {
  const feeRefundedBefore = tip.feeRefundedCents ?? 0;
  const refundedCents = (tip.refundedCents ?? 0) + amountCents;
  const feeRefundedCents = Math.max(feeRefundedBefore, proportionalFeeRefundCents(tip.platformGrossFeeCents, tip.grossCents, refundedCents));
  const feeBackCents = feeRefundedCents - feeRefundedBefore;
  return {
    customerCents: amountCents,
    feeBackCents,
    driverBearsCents: amountCents - feeBackCents,
    complete: refundedCents === tip.grossCents,
    after: effectiveTip({ ...tip, refundedCents, feeRefundedCents }),
  };
}
