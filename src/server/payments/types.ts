import type { PaymentPurpose } from "@/lib/db/types";

/**
 * Payment-Abstraktion. Die Geschäftslogik kennt keinen konkreten Anbieter –
 * ein Wechsel (Adyen, Mollie, Mangopay …) ist ein neues Modul, sonst nichts.
 */

export type CreatePaymentInput = {
  /** Unsere Payment-ID, kommt über Metadaten im Webhook zurück. */
  paymentId: string;
  purpose: PaymentPurpose;
  referenceId: string;
  /** Exakt der Betrag, den der Kunde zahlt. */
  amountCents: number;
  /** Plattformanteil bei direkter Weiterleitung an den Zusteller. */
  applicationFeeCents: number | null;
  /** Konto des Zustellers beim Anbieter, falls einsatzbereit. */
  destinationAccountId: string | null;
  /** Für Direct Charges: der interne, serverseitig ermittelte Kontoinhaber. */
  driverId?: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
};

export type CreatePaymentResult = {
  providerPaymentId: string;
  /** Hierhin wird der Kunde weitergeleitet. */
  redirectUrl: string;
};

export type OnboardingLink = { accountId: string; url: string };

export interface PaymentProvider {
  readonly id: string;
  readonly isSandbox: boolean;
  /** Welche Zahlarten der Kunde voraussichtlich sieht – nur zur Anzeige. */
  readonly methodsLabel: string;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  refundPayment(providerIntentId: string): Promise<void>;

  createConnectedAccount(input: { email: string; driverId: string }): Promise<string>;
  onboardDriver(input: { accountId: string; driverId: string; returnUrl: string; refreshUrl: string }): Promise<OnboardingLink>;
  isAccountReady(accountId: string, driverId: string): Promise<boolean>;

}
