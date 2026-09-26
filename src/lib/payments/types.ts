/**
 * Payment-Abstraktion (§75).
 *
 * Die Geschaeftslogik kennt Stripe nicht. Wer den Provider wechselt,
 * implementiert dieses Interface neu und aendert eine Umgebungsvariable.
 */

export type PaymentIntentStatus = "pending" | "succeeded" | "failed";

export type CreatePaymentInput = {
  tipId: string;
  driverId: string;
  /** Was der Kunde zahlt, in Cent. Exakt der gewaehlte Betrag (§70). */
  grossCents: number;
  /** Was dem Zusteller zusteht, in Cent. */
  driverCents: number;
  /** Brutto-Plattformgebuehr, in Cent. */
  platformFeeCents: number;
  /** Auszahlungskonto des Zustellers beim Provider, falls vorhanden. */
  destinationAccountId: string | null;
  description: string;
  /** Wohin der Kunde nach der Zahlung zurueckkehrt. */
  returnUrl: string;
  cancelUrl: string;
};

export type CreatePaymentResult = {
  providerPaymentId: string;
  /** Wenn gesetzt, muss der Kunde dorthin weitergeleitet werden. */
  redirectUrl: string | null;
  status: PaymentIntentStatus;
};

export type ProviderFees = {
  percent: number;
  fixedCents: number;
  label: string;
};

export type OnboardingLink = {
  accountId: string;
  url: string;
};

export interface PaymentProvider {
  readonly id: string;
  /** Laeuft der Provider im Test-/Sandbox-Modus? */
  readonly isSandbox: boolean;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentIntentStatus>;
  confirmPayment(providerPaymentId: string): Promise<PaymentIntentStatus>;
  refundPayment(providerPaymentId: string): Promise<void>;

  createConnectedAccount(input: { email: string; driverId: string }): Promise<string>;
  onboardDriver(input: {
    accountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<OnboardingLink>;
  isAccountReady(accountId: string): Promise<boolean>;

  createPayout(input: { accountId: string; amountCents: number }): Promise<void>;

  getFees(): ProviderFees;
}
