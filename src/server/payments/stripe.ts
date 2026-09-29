import "server-only";
import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { isAllowedTipAmount, splitTip } from "@/lib/money";
import { isProductionRuntime } from "@/lib/runtime";
import { ServiceError } from "../errors";
import type { PaymentProvider } from "./types";

/** Trinkgelder sind Direct Charges; nur Kartenkäufe belasten das Plattformkonto. */
let stripe: Stripe | null = null;

export function stripeClient(): Stripe {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  stripe = new Stripe(key);
  return stripe;
}

/** Legacy Express/Custom und Plattform-Gebührenmodelle scheitern geschlossen. */
export function stripeAccountReady(account: Stripe.Account): boolean {
  return stripeAccountCompatible(account) && account.charges_enabled === true && account.payouts_enabled === true &&
    account.details_submitted === true && account.capabilities?.card_payments === "active" &&
    account.capabilities?.transfers === "active";
}

export function stripeAccountCompatible(account: Stripe.Account, driverId?: string): boolean {
  return account.type === "standard" && account.country === "DE" && account.controller?.fees?.payer === "account" &&
    account.controller?.losses?.payments === "stripe" &&
    (!driverId || account.metadata?.driverId === driverId);
}

export const stripePaymentProvider: PaymentProvider = {
  id: "stripe",
  get isSandbox() {
    return !/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  },
  methodsLabel: "Apple Pay, Google Pay oder Karte",

  async createPayment(input) {
    const liveKey = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
    if ((process.env.VERCEL_ENV === "preview" && liveKey) ||
        (isProductionRuntime() && !liveKey)) {
      throw new Error("Stripe-Schlüssel passt nicht zur Deployment-Umgebung.");
    }
    const direct = input.purpose === "tip";
    if (direct && (!isAllowedTipAmount(input.amountCents) || !input.destinationAccountId ||
        input.applicationFeeCents !== splitTip(input.amountCents).platformGrossFeeCents ||
        !input.driverId || !await this.isAccountReady(input.destinationAccountId, input.driverId))) {
      throw new Error("Trinkgeld benötigt ein geeignetes, einsatzbereites Stripe-Konto.");
    }
    if (!direct && (input.destinationAccountId || input.applicationFeeCents !== null)) {
      throw new Error("Kartenbestellungen dürfen keine Fahrer-Application-Fee enthalten.");
    }
    const metadata = { paymentId: input.paymentId, purpose: input.purpose, referenceId: input.referenceId };
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      locale: "de",
      submit_type: "pay",
      // Kartenbasierte Wallets bleiben möglich; PayPal ist bewusst nicht aktiviert.
      payment_method_types: ["card"],
      line_items: [{ quantity: 1, price_data: {
        currency: "eur", unit_amount: input.amountCents, product_data: { name: input.description },
      } }],
      payment_intent_data: {
        description: input.description,
        metadata,
        ...(direct ? { application_fee_amount: input.applicationFeeCents! } : {}),
      },
      metadata,
      success_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    }, {
      idempotencyKey: `checkout_${input.paymentId}`,
      ...(direct ? { stripeAccount: input.destinationAccountId! } : {}),
    });
    if (!session.url) throw new Error("Stripe hat keine Checkout-URL geliefert.");
    return { providerPaymentId: session.id, redirectUrl: session.url };
  },

  async refundPayment(providerIntentId) {
    const payment = await getDb().payments.findOne({ providerIntentId });
    if (!payment || payment.provider !== "stripe") throw new Error("Zahlung für Erstattung nicht gefunden.");
    const tip = payment.purpose === "tip" ? await getDb().tips.get(payment.referenceId) : null;
    if (payment.purpose === "tip" && !tip?.destinationAccountId) {
      throw new Error("Direct-Charge-Konto für Erstattung fehlt.");
    }
    await stripeClient().refunds.create({
      payment_intent: providerIntentId,
      ...(tip ? { refund_application_fee: true } : {}),
    }, {
      idempotencyKey: `full_refund_${payment.id}`,
      ...(tip ? { stripeAccount: tip.destinationAccountId! } : {}),
    });
  },

  async createConnectedAccount({ email, driverId }) {
    // Standard: Stripe erhebt Payment-/Connect-Kosten beim Account und trägt
    // dessen Negativsaldo-Risiko. Existing Express-Konten werden nicht umgedeutet.
    const account = await stripeClient().accounts.create({
      type: "standard",
      country: "DE",
      email,
      business_type: "individual",
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { driverId },
    }, { idempotencyKey: `driver_account_standard_${driverId}` });
    if (account.type !== "standard") {
      throw new ServiceError("connect_account_incompatible",
        "Stripe hat kein geeignetes Standard-Konto erstellt. Bitte kontaktiere den Lieferdank-Support.", 502);
    }
    return account.id;
  },

  async onboardDriver({ accountId, driverId, returnUrl, refreshUrl }) {
    const account = await stripeClient().accounts.retrieve(accountId);
    if (!stripeAccountCompatible(account, driverId)) {
      throw new ServiceError("connect_account_incompatible",
        "Dieses Stripe-Konto kann für Lieferdank-Trinkgeld nicht verwendet werden. Bitte kontaktiere den Lieferdank-Support.", 409);
    }
    const link = await stripeClient().accountLinks.create({
      account: accountId, type: "account_onboarding", return_url: returnUrl, refresh_url: refreshUrl,
    });
    return { accountId, url: link.url };
  },

  async isAccountReady(accountId, driverId) {
    const account = await stripeClient().accounts.retrieve(accountId);
    return stripeAccountReady(account) && stripeAccountCompatible(account, driverId);
  },
};
