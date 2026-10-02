import "server-only";
import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { isAllowedTipAmount, splitTip } from "@/lib/money";
import { classifyUrl } from "@/lib/base-url";
import { isProductionRuntime } from "@/lib/runtime";
import { ServiceError } from "../errors";
import { errorMessage, logEvent } from "../events";
import type { PaymentProvider } from "./types";

/** Trinkgelder sind Direct Charges; nur Kartenkäufe belasten das Plattformkonto. */
let stripe: Stripe | null = null;

/** Laut Stripe nur intern für Risiko und Underwriting – nicht öffentlich. */
export const DRIVER_PRODUCT_DESCRIPTION =
  "Freiwillige Trinkgelder von Kundinnen und Kunden für Zustellungen, empfangen über die Plattform Lieferdank (lieferdank.de). Es werden keine Waren verkauft.";

/**
 * Text auf dem Kontoauszug der Kunden (settings.payments.statement_descriptor).
 * Stripe: 5–22 lateinische Zeichen, mind. ein Buchstabe, kein < > \ ' " *.
 * Das Kurzpräfix für Kartenzahlungen leitet Stripe selbst ab ("LIEFERDANK").
 */
export const DRIVER_STATEMENT_DESCRIPTOR = "LIEFERDANK TRINKGELD";

/**
 * Stripes eigener Standard für neue deutsche Standard-Konten – hier bewusst
 * festgeschrieben, damit kein Konto auf „manuell“ startet. Das Onboarding
 * zeigt den Wert als „Automatisch jeden Tag“ und lässt ihn den Lieferanten ändern.
 */
export const DRIVER_PAYOUT_INTERVAL = "daily";

function isPublicHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:" && classifyUrl(value) === "public";
  } catch {
    return false;
  }
}

/**
 * Live-Schlüssel gehören ausschließlich in die Produktion, Testschlüssel nie dorthin.
 * Gilt für jeden schreibenden Stripe-Aufruf – eine Preview mit Live-Schlüssel darf
 * weder Zahlungen noch Connect-Konten oder Onboarding-Links anlegen.
 */
function assertKeyMatchesEnvironment(): void {
  const liveKey = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  if (liveKey !== isProductionRuntime()) {
    throw new Error("Stripe-Schlüssel passt nicht zur Deployment-Umgebung.");
  }
}

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

/**
 * Stripe verweigert der Plattform den Zugriff auf genau dieses Konto (account_invalid).
 * Das beweist KEINE Löschung – Stripes eigene Meldung lautet sinngemäß „kein Zugriff
 * … oder das Konto existiert nicht; der Zugriff wurde womöglich entzogen“, und derselbe
 * Code käme bei einem falschen Plattform-Schlüssel für jedes Konto. Kein Stripe-Fehler
 * unterscheidet das zuverlässig, deshalb folgt daraus nie ein gespeicherter Zustand –
 * nur ein neutraler Hinweis und ein Ereignis für den Betrieb.
 */
export function stripeAccountAccessDenied(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeError && error.code === "account_invalid";
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
    assertKeyMatchesEnvironment();
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
    assertKeyMatchesEnvironment();
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

  async createConnectedAccount({ email, driverId, profileUrl }) {
    assertKeyMatchesEnvironment();
    // Standard: Stripe erhebt Payment-/Connect-Kosten beim Account und trägt
    // dessen Negativsaldo-Risiko. Existing Express-Konten werden nicht umgedeutet.
    // Lieferanten haben meist keine eigene Website. Stripe sieht dafür die
    // Profilseite auf der Plattform bzw. eine Produktbeschreibung vor; beides
    // ist wahr und vor Vertragsannahme vom Lieferanten änderbar. Nach dem ersten
    // Account Link kann die Plattform das bei Standard-Konten nicht mehr setzen.
    const url = profileUrl && isPublicHttpsUrl(profileUrl) ? profileUrl : null;
    const account = await stripeClient().accounts.create({
      type: "standard",
      country: "DE",
      email,
      business_type: "individual",
      business_profile: { product_description: DRIVER_PRODUCT_DESCRIPTION, ...(url ? { url } : {}) },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      settings: {
        payments: { statement_descriptor: DRIVER_STATEMENT_DESCRIPTOR },
        payouts: { schedule: { interval: DRIVER_PAYOUT_INTERVAL } },
      },
      metadata: { driverId },
      // v3: Stripe lehnt denselben Idempotency-Key mit geänderten Parametern ab.
    }, { idempotencyKey: `driver_account_standard_v3_${driverId}` });
    if (account.type !== "standard") {
      throw new ServiceError("connect_account_incompatible",
        "Stripe hat kein geeignetes Standard-Konto erstellt. Bitte kontaktiere den Lieferdank-Support.", 502);
    }
    return account.id;
  },

  async onboardDriver({ accountId, driverId, returnUrl, refreshUrl }) {
    assertKeyMatchesEnvironment();
    const incompatible = () => new ServiceError("connect_account_incompatible",
      "Dieses Stripe-Konto kann für Lieferdank-Trinkgeld nicht verwendet werden. Bitte kontaktiere den Lieferdank-Support.", 409);
    let account: Stripe.Account;
    try {
      account = await stripeClient().accounts.retrieve(accountId);
    } catch (error) {
      // Ursache offen (Konto getrennt, gelöscht oder Schlüssel ohne Zugriff): nichts behaupten,
      // nichts speichern – aber der Betrieb muss den Fall sehen und der Lieferant einen Ausweg haben.
      // Jeder andere Fehler bleibt eine gewöhnliche Störung.
      if (stripeAccountAccessDenied(error)) {
        await logEvent("error", "stripe-connect", "Stripe verweigert den Zugriff auf das Connect-Konto – Ursache offen, Onboarding abgebrochen", {
          driverId, accountId, error: errorMessage(error),
        });
        throw new ServiceError("connect_account_unreachable",
          "Stripe lässt den Zugriff auf dein Auszahlungskonto gerade nicht zu. Bitte versuche es später erneut – bleibt es dabei, melde dich beim Lieferdank-Support.", 503);
      }
      throw error;
    }
    if (!stripeAccountCompatible(account, driverId)) {
      await logEvent("error", "stripe-connect", "Connect-Konto nicht verwendbar – Onboarding abgebrochen", {
        driverId, accountId, accountType: account.type, country: account.country,
      });
      throw incompatible();
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

  async payoutInterval(accountId) {
    // Nur ein Hinweis in der Oberfläche: kurz warten, nicht wiederholen.
    const account = await stripeClient().accounts.retrieve(accountId, {}, { timeout: 4000, maxNetworkRetries: 0 });
    return account.settings?.payouts?.schedule?.interval === "manual" ? "manual" : "automatic";
  },
};
