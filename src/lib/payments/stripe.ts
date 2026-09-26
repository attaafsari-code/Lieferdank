import "server-only";
import Stripe from "stripe";
import { PROVIDER_FEE_FIXED_CENTS, PROVIDER_FEE_PERCENT } from "../money";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  OnboardingLink,
  PaymentIntentStatus,
  PaymentProvider,
  ProviderFees,
} from "./types";

/**
 * Stripe Connect (Destination Charges).
 *
 * Der Kunde zahlt den Bruttobetrag an Lieferdank, Stripe leitet den
 * Zusteller-Anteil automatisch an dessen Connected Account weiter und
 * behaelt `application_fee_amount` bei der Plattform (§71).
 *
 * Verifikation der Zahlung passiert ausschliesslich serverseitig ueber
 * den Webhook -- niemals auf Basis der Rueckkehr-URL (§92).
 */

let stripe: Stripe | null = null;

function client(): Stripe {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  stripe = new Stripe(key);
  return stripe;
}

export const stripePaymentProvider: PaymentProvider = {
  id: "stripe",
  get isSandbox() {
    return !(process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live");
  },

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const session = await client().checkout.sessions.create({
      mode: "payment",
      locale: "de",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: input.grossCents,
            product_data: { name: input.description },
          },
        },
      ],
      payment_intent_data: {
        description: input.description,
        metadata: { tipId: input.tipId, driverId: input.driverId },
        ...(input.destinationAccountId
          ? {
              application_fee_amount: input.platformFeeCents,
              transfer_data: { destination: input.destinationAccountId },
            }
          : {}),
      },
      metadata: { tipId: input.tipId, driverId: input.driverId },
      success_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    });

    return {
      providerPaymentId: session.id,
      redirectUrl: session.url,
      status: "pending",
    };
  },

  async getPaymentStatus(providerPaymentId): Promise<PaymentIntentStatus> {
    const session = await client().checkout.sessions.retrieve(providerPaymentId);
    if (session.payment_status === "paid") return "succeeded";
    if (session.status === "expired") return "failed";
    return "pending";
  },

  async confirmPayment(providerPaymentId): Promise<PaymentIntentStatus> {
    return stripePaymentProvider.getPaymentStatus(providerPaymentId);
  },

  async refundPayment(providerPaymentId): Promise<void> {
    const session = await client().checkout.sessions.retrieve(providerPaymentId);
    const paymentIntent = session.payment_intent;
    if (!paymentIntent) return;
    await client().refunds.create({
      payment_intent: typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id,
    });
  },

  async createConnectedAccount({ email, driverId }): Promise<string> {
    const account = await client().accounts.create({
      type: "express",
      country: "DE",
      email,
      business_type: "individual",
      capabilities: { transfers: { requested: true } },
      metadata: { driverId },
    });
    return account.id;
  },

  async onboardDriver({ accountId, returnUrl, refreshUrl }): Promise<OnboardingLink> {
    const link = await client().accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return { accountId, url: link.url };
  },

  async isAccountReady(accountId): Promise<boolean> {
    const account = await client().accounts.retrieve(accountId);
    return Boolean(account.payouts_enabled && account.details_submitted);
  },

  async createPayout({ accountId, amountCents }): Promise<void> {
    await client().transfers.create({
      amount: amountCents,
      currency: "eur",
      destination: accountId,
    });
  },

  getFees(): ProviderFees {
    return {
      percent: PROVIDER_FEE_PERCENT,
      fixedCents: PROVIDER_FEE_FIXED_CENTS,
      label: "Stripe Connect",
    };
  },
};
