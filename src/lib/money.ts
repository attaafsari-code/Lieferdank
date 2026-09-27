/**
 * Geldlogik von Lieferdank.
 *
 *  - Der Kunde zahlt EXAKT den gewählten Betrag. Keine Aufschläge im Checkout.
 *  - Pro Trinkgeld behält die Plattform brutto 0,50 € ein.
 *  - Die 0,50 € sind NICHT der Gewinn: Payment- und Auszahlungskosten gehen ab.
 *
 * Alle Beträge sind Integer in Cent. Niemals Floats für Geld.
 */

export const CURRENCY = "EUR";

/** Feste Trinkgeld-Buttons. */
export const TIP_OPTIONS_CENTS = [200, 300, 500] as const;

export const MIN_TIP_CENTS = 200;
export const MAX_TIP_CENTS = 500;

export const PLATFORM_GROSS_FEE_CENTS = 50;

function envNumber(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const value = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** Kalkulierte Payment-Kosten. Default: Stripe DE Karten (1,5 % + 0,25 €). */
export const PROVIDER_FEE_PERCENT = envNumber("PAYMENT_FEE_PERCENT", 1.5);
export const PROVIDER_FEE_FIXED_CENTS = envNumber("PAYMENT_FEE_FIXED_CENTS", 25);

/** Kalkulierte Auszahlungskosten. Default: Stripe Connect (0,25 % + 0,10 €). */
export const PAYOUT_FEE_PERCENT = envNumber("PAYOUT_FEE_PERCENT", 0.25);
export const PAYOUT_FEE_FIXED_CENTS = envNumber("PAYOUT_FEE_FIXED_CENTS", 10);

export type TipSplit = {
  grossCents: number;
  driverCents: number;
  platformGrossFeeCents: number;
  paymentProviderFeeCents: number;
  /** Zum Zahlungszeitpunkt 0 – wird erst bei der Auszahlung verteilt. */
  payoutFeeCents: number;
  platformNetRevenueCents: number;
};

export function estimateProviderFeeCents(grossCents: number): number {
  return Math.round((grossCents * PROVIDER_FEE_PERCENT) / 100 + PROVIDER_FEE_FIXED_CENTS);
}

export function estimatePayoutFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round((amountCents * PAYOUT_FEE_PERCENT) / 100 + PAYOUT_FEE_FIXED_CENTS);
}

export function splitTip(grossCents: number): TipSplit {
  if (!Number.isInteger(grossCents) || grossCents <= 0) {
    throw new Error("splitTip: grossCents muss ein positiver Integer sein");
  }
  const platformGrossFeeCents = Math.min(PLATFORM_GROSS_FEE_CENTS, grossCents);
  const paymentProviderFeeCents = estimateProviderFeeCents(grossCents);
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
 * Verteilt eine Auszahlungsgebühr cent-genau auf mehrere Trinkgelder.
 * Die Summe der Anteile ergibt immer exakt die Gebühr.
 */
export function allocateFee(feeCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(feeCents / count);
  const remainder = feeCents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
