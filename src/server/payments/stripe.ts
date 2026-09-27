import "server-only";
import Stripe from "stripe";
import type { PaymentProvider } from "./types";

/**
 * Stripe Connect mit Checkout.
 *
 * Checkout zeigt automatisch die im Stripe-Dashboard aktivierten Zahlarten:
 * Karte, Apple Pay, Google Pay, Link und – nach Freischaltung – PayPal.
 * Kartendaten berührt Lieferdank nie.
 *
 * Bei einem einsatzbereiten Zusteller-Konto fließt der Anteil direkt dorthin
 * (Destination Charge), die Plattform behält `application_fee_amount`.
 * Sonst hält die Plattform das Geld bis zur Auszahlung.
 *
 * Eine Zahlung gilt erst als erfolgreich, wenn der signierte Webhook sie meldet.
 */

let stripe: Stripe | null = null;

export function stripeClient(): Stripe {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  stripe = new Stripe(key);
  return stripe;
}

export const stripePaymentProvider: PaymentProvider = {
  id: "stripe",
  get isSandbox() {
    return !/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  },
  methodsLabel: "Apple Pay, Google Pay oder Karte",

  async createPayment(input) {
    const metadata = { paymentId: input.paymentId, purpose: input.purpose, referenceId: input.referenceId };
    const direct = input.destinationAccountId && input.applicationFeeCents !== null;

    const session = await stripeClient().checkout.sessions.create(
      {
        mode: "payment",
        locale: "de",
        submit_type: "pay",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: input.amountCents,
              product_data: { name: input.description },
            },
          },
        ],
        payment_intent_data: {
          description: input.description,
          metadata,
          ...(direct
            ? {
                application_fee_amount: input.applicationFeeCents!,
                transfer_data: { destination: input.destinationAccountId! },
              }
            : {}),
        },
        metadata,
        success_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
      // Schützt vor Doppelbuchung, falls dieselbe Anfrage zweimal ankommt.
      { idempotencyKey: `checkout_${input.paymentId}` },
    );

    if (!session.url) throw new Error("Stripe hat keine Checkout-URL geliefert.");
    return { providerPaymentId: session.id, redirectUrl: session.url };
  },

  async refundPayment(providerIntentId) {
    await stripeClient().refunds.create({ payment_intent: providerIntentId, reverse_transfer: true });
  },

  async createConnectedAccount({ email, driverId }) {
    const account = await stripeClient().accounts.create(
      {
        type: "express",
        country: "DE",
        email,
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        metadata: { driverId },
      },
      { idempotencyKey: `driver_account_${driverId}` },
    );
    return account.id;
  },

  async onboardDriver({ accountId, returnUrl, refreshUrl }) {
    const link = await stripeClient().accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return { accountId, url: link.url };
  },

  async isAccountReady(accountId) {
    const account = await stripeClient().accounts.retrieve(accountId);
    return Boolean(account.payouts_enabled && account.details_submitted);
  },

  async createPayout({ accountId, amountCents, payoutId }) {
    const transfer = await stripeClient().transfers.create(
      { amount: amountCents, currency: "eur", destination: accountId, metadata: { payoutId } },
      { idempotencyKey: `payout_${payoutId}` },
    );
    return transfer.id;
  },
};
