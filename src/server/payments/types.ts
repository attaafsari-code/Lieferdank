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

export type RefundState = {
  amountCents: number;
  /** Bisher an den Kunden erstattet (kumulativ). */
  refundedCents: number;
  feeCents: number;
  /** Bisher zurückgegebene Plattformgebühr (kumulativ). */
  feeRefundedCents: number;
  /** Verweis auf die Gebühr beim Anbieter; null, solange sie dort noch nicht existiert. */
  feeReference: string | null;
  /** Rückbuchung am Vorgang: keine automatische Geldbewegung, Klärung von Hand. */
  disputed: boolean;
};

export interface PaymentProvider {
  readonly id: string;
  readonly isSandbox: boolean;
  /** Welche Zahlarten der Kunde voraussichtlich sieht – nur zur Anzeige. */
  readonly methodsLabel: string;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /**
   * Erstattet amountCents der Zahlung an den Kunden. Bei Trinkgeldern gibt der Anbieter dabei
   * den anteiligen Plattformanteil zurück. expectedRefundedCents ist der Erstattungsstand, den
   * der Auftraggeber gesehen hat: Zu jedem Stand gibt es höchstens eine Erstattung – derselbe
   * Auftrag liefert dieselbe, ein abweichender wird abgewiesen.
   */
  refundPayment(input: { providerIntentId: string; amountCents: number; expectedRefundedCents: number }): Promise<void>;
  /** Tatsächlicher Erstattungsstand beim Anbieter – maßgeblich für jede Verbuchung. */
  refundState(providerIntentId: string): Promise<RefundState>;
  /**
   * Gibt amountCents der Plattformgebühr zurück. alreadyRefundedCents ist der zuvor gelesene
   * Stand: Zwei Rückgaben auf denselben Stand kann es nicht geben.
   */
  refundPlatformFee(input: { paymentId: string; feeReference: string; amountCents: number; alreadyRefundedCents: number }): Promise<void>;

  /**
   * profileUrl: öffentliche Lieferdank-Seite des Lieferanten, Stripe schlägt sie als Website vor.
   * Name und Telefon stammen aus dem Lieferdank-Profil und ersparen dem Lieferanten Tipparbeit.
   */
  createConnectedAccount(input: {
    email: string; driverId: string; profileUrl?: string | null;
    firstName?: string | null; lastName?: string | null; phone?: string | null;
  }): Promise<string>;
  /**
   * true nur für ein eigenes, noch unberührtes Konto aus der Zeit vor der Vorbelegung, das ohne
   * Verlust durch ein vorbelegtes ersetzt werden darf. Im Zweifel false.
   */
  isReplaceableLegacyAccount(accountId: string, driverId: string): Promise<boolean>;
  onboardDriver(input: { accountId: string; driverId: string; returnUrl: string; refreshUrl: string }): Promise<OnboardingLink>;
  isAccountReady(accountId: string, driverId: string): Promise<boolean>;
  /** "manual": Stripe überweist das Guthaben nicht von selbst aufs Bankkonto. */
  payoutInterval(accountId: string): Promise<"manual" | "automatic">;

}
