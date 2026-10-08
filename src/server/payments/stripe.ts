import "server-only";
import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { isAllowedTipAmount, splitTip } from "@/lib/money";
import { classifyUrl } from "@/lib/base-url";
import { isProductionRuntime } from "@/lib/runtime";
import { ServiceError } from "../errors";
import { errorMessage, logEvent } from "../events";
import type { PaymentProvider } from "./types";
import { CHECKOUT_BRANDING } from "./checkout-branding";

/** Trinkgelder sind Direct Charges; nur Kartenkäufe belasten das Plattformkonto. */
let stripe: Stripe | null = null;

/**
 * Laut Stripe nur intern für Risiko und Underwriting – nicht öffentlich. Stripe erwartet
 * darin auch, wie und wofür gezahlt wird.
 */
export const DRIVER_PRODUCT_DESCRIPTION =
  "Freiwillige Trinkgelder von Kundinnen und Kunden für Zustellungen, empfangen über die Plattform Lieferdank (lieferdank.de). " +
  "Kundinnen und Kunden zahlen einmalig 2, 3 oder 5 € per Karte, Apple Pay oder Google Pay über Stripe Checkout. " +
  "Es werden keine Waren verkauft.";

/**
 * Branche des Kontos (MCC): Kurierdienste – die Tätigkeit, für die das Trinkgeld gegeben wird.
 * Stripe prüft die Angabe selbst und kann sie korrigieren.
 */
export const DRIVER_MCC = "4215";

/** Kundenkontakt bei Fragen zu einem Trinkgeld ist Lieferdank, nicht die private Adresse des Lieferanten. */
export const DRIVER_SUPPORT_EMAIL = "info@lieferdank.de";
export const DRIVER_SUPPORT_URL = "https://lieferdank.de/legal/impressum";

/** Marke an Konten, die mit vollständiger Vorbelegung angelegt wurden. Ältere Konten tragen sie nicht. */
export const DRIVER_PREFILL_VERSION = "4";

/**
 * Nur eindeutig internationale Nummern (E.164) gehen an Stripe – eine ungültige Nummer ließe
 * die Kontoanlage scheitern. Alles andere fragt Stripe im Formular selbst ab.
 */
export function internationalPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/[\s\-./]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) return null;
  // „+49 0170 …“: die Inlands-Null hinter der Ländervorwahl macht die Nummer mehrdeutig.
  if (compact.startsWith("+490")) return null;
  return compact;
}

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

/**
 * Darf ein gespeichertes Konto durch ein vorbelegtes ersetzt werden? Nur, wenn es eindeutig
 * ein eigenes Konto aus der Zeit vor der Vorbelegung ist und noch nichts Wesentliches daran
 * hängt: nicht abgeschickt, nichts freigeschaltet, keine Branche gewählt, keine Bankverbindung,
 * Bedingungen nicht akzeptiert, keine laufende Prüfung, nicht von Stripe abgelehnt.
 * Im Zweifel: nein – ein Konto mit Ablehnung oder Prüfung darf nie „neu gestartet“ werden.
 */
export function stripeAccountReplaceable(account: Stripe.Account, driverId: string): boolean {
  const due = account.requirements?.currently_due ?? [];
  return stripeAccountCompatible(account, driverId) &&
    !account.metadata?.lieferdankPrefill &&
    account.details_submitted === false && account.charges_enabled === false && account.payouts_enabled === false &&
    account.requirements?.disabled_reason === "requirements.past_due" &&
    (account.requirements?.pending_verification ?? []).length === 0 &&
    !account.business_profile?.mcc &&
    ["business_profile.mcc", "external_account", "tos_acceptance.date"].every((field) => due.includes(field)) &&
    (account.external_accounts?.data ?? []).length === 0;
}

export function stripeAccountCompatible(account: Stripe.Account, driverId?: string): boolean {
  return account.type === "standard" && account.country === "DE" && account.controller?.fees?.payer === "account" &&
    account.controller?.losses?.payments === "stripe" &&
    (!driverId || account.metadata?.driverId === driverId);
}

/** Zahlung und – bei Trinkgeldern – das Konto des Lieferanten, auf dem die Buchung liegt. */
async function refundContext(providerIntentId: string) {
  const payment = await getDb().payments.findOne({ providerIntentId });
  if (!payment || payment.provider !== "stripe") throw new Error("Zahlung für Erstattung nicht gefunden.");
  const tip = payment.purpose === "tip" ? await getDb().tips.get(payment.referenceId) : null;
  if (payment.purpose === "tip" && !tip?.destinationAccountId) {
    throw new Error("Direct-Charge-Konto für Erstattung fehlt.");
  }
  return { payment, stripeAccount: tip?.destinationAccountId ?? null };
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
    const params: Stripe.Checkout.SessionCreateParams & { branding_settings: typeof CHECKOUT_BRANDING } = {
      mode: "payment",
      locale: "de",
      submit_type: "pay",
      branding_settings: CHECKOUT_BRANDING,
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
    };
    const session = await stripeClient().checkout.sessions.create(params, {
      idempotencyKey: `checkout_${input.paymentId}`,
      ...(direct ? { stripeAccount: input.destinationAccountId! } : {}),
    });
    if (!session.url) throw new Error("Stripe hat keine Checkout-URL geliefert.");
    return { providerPaymentId: session.id, redirectUrl: session.url };
  },

  async refundPayment({ providerIntentId, amountCents, expectedRefundedCents }) {
    assertKeyMatchesEnvironment();
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !Number.isSafeInteger(expectedRefundedCents) || expectedRefundedCents < 0) {
      throw new Error("Ungültiger Erstattungsbetrag.");
    }
    const { payment, stripeAccount } = await refundContext(providerIntentId);
    await stripeClient().refunds.create({
      payment_intent: providerIntentId,
      amount: amountCents,
      // Stripe gibt die Application Fee nie von selbst zurück. Mit diesem Schalter anteilig zum
      // erstatteten Betrag – und vollständig, sobald die Zahlung ganz erstattet ist.
      ...(stripeAccount ? { refund_application_fee: true } : {}),
      metadata: { paymentId: payment.id, source: "lieferdank" },
    }, {
      // Pro gesehenem Erstattungsstand höchstens eine Erstattung: Mehrfachklick und Wiederholung
      // liefern bei Stripe dieselbe Erstattung, ein zweiter Auftrag mit anderem Betrag zum selben
      // Stand wird von Stripe abgewiesen. Der Schlüssel enthält deshalb bewusst keinen Betrag.
      idempotencyKey: `ld_refund_${payment.id}_from_${expectedRefundedCents}`,
      ...(stripeAccount ? { stripeAccount } : {}),
    });
  },

  async refundState(providerIntentId) {
    const { stripeAccount } = await refundContext(providerIntentId);
    const intent = await stripeClient().paymentIntents.retrieve(
      providerIntentId, { expand: ["latest_charge"] }, stripeAccount ? { stripeAccount } : {},
    );
    const charge = intent.latest_charge;
    if (!charge || typeof charge === "string") throw new Error("Stripe hat zur Zahlung keine Buchung geliefert.");
    const feeReference = typeof charge.application_fee === "string" ? charge.application_fee : charge.application_fee?.id ?? null;
    // Die Gebühr liegt auf dem Plattformkonto, nicht auf dem Konto des Lieferanten. Sie wird nach
    // der Buchung gelesen: Ihr Rückgabestand ist damit mindestens so aktuell wie die Erstattung.
    const fee = feeReference ? await stripeClient().applicationFees.retrieve(feeReference) : null;
    return {
      amountCents: charge.amount,
      refundedCents: charge.amount_refunded,
      feeCents: fee?.amount ?? charge.application_fee_amount ?? 0,
      feeRefundedCents: fee?.amount_refunded ?? 0,
      feeReference,
      disputed: charge.disputed === true,
    };
  },

  async refundPlatformFee({ paymentId, feeReference, amountCents, alreadyRefundedCents }) {
    assertKeyMatchesEnvironment();
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !Number.isSafeInteger(alreadyRefundedCents) || alreadyRefundedCents < 0) {
      throw new Error("Ungültiger Gebührenbetrag.");
    }
    await stripeClient().applicationFees.createRefund(feeReference, {
      amount: amountCents,
      metadata: { paymentId, source: "lieferdank" },
    }, {
      // Der Schlüssel hängt am zuvor gelesenen Rückgabestand. Zwei gleichzeitige Abgleiche lesen
      // denselben Stand: Stripe führt dann genau eine Rückgabe aus und weist die andere ab.
      // Nach jeder Rückgabe ist der Stand ein anderer – der Schlüssel wiederholt sich nie.
      idempotencyKey: `ld_fee_refund_${paymentId}_from_${alreadyRefundedCents}`,
    });
  },

  async createConnectedAccount({ email, driverId, profileUrl, firstName, lastName, phone }) {
    assertKeyMatchesEnvironment();
    // Standard: Stripe erhebt Payment-/Connect-Kosten beim Account und trägt
    // dessen Negativsaldo-Risiko. Existing Express-Konten werden nicht umgedeutet.
    // Ein Lieferant soll bei Stripe nur angeben, was Stripe von ihm persönlich braucht
    // (Geburtsdatum, Anschrift, Bankverbindung, Ausweis, Zustimmung). Alles, was für jeden
    // Lieferdank-Lieferanten gleich und wahr ist, belegen wir vor: Branche, Profilseite als
    // Website, Beschreibung, Kundenkontakt – dazu Name und E-Mail aus seinem Profil.
    // Der Lieferant bestätigt die Angaben im Formular und kann sie dort ändern. Nach dem
    // ersten Account Link kann die Plattform das bei Standard-Konten nicht mehr setzen.
    const url = profileUrl && isPublicHttpsUrl(profileUrl) ? profileUrl : null;
    const first = firstName?.trim();
    const last = lastName?.trim();
    const params = (withPhone: string | null): Stripe.AccountCreateParams => ({
      type: "standard",
      country: "DE",
      email,
      business_type: "individual",
      business_profile: {
        mcc: DRIVER_MCC,
        product_description: DRIVER_PRODUCT_DESCRIPTION,
        support_email: DRIVER_SUPPORT_EMAIL,
        support_url: DRIVER_SUPPORT_URL,
        ...(url ? { url } : {}),
      },
      individual: {
        email,
        ...(first ? { first_name: first } : {}),
        ...(last ? { last_name: last } : {}),
        ...(withPhone ? { phone: withPhone } : {}),
      },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      settings: {
        payments: { statement_descriptor: DRIVER_STATEMENT_DESCRIPTOR },
        payouts: { schedule: { interval: DRIVER_PAYOUT_INTERVAL } },
      },
      metadata: { driverId, lieferdankPrefill: DRIVER_PREFILL_VERSION },
    });
    // v4: Stripe lehnt denselben Idempotency-Key mit geänderten Parametern ab.
    const key = `driver_account_standard_v4_${driverId}`;
    const validPhone = internationalPhone(phone);
    let account: Stripe.Account;
    try {
      account = await stripeClient().accounts.create(params(validPhone), { idempotencyKey: key });
    } catch (error) {
      // Stripe prüft Telefonnummern strenger als wir. Lehnt es die Nummer ab, bleibt sie weg
      // und Stripe fragt sie im Formular selbst ab – die Einrichtung darf daran nicht scheitern.
      if (!validPhone || !(error instanceof Stripe.errors.StripeInvalidRequestError) || error.param !== "individual[phone]") throw error;
      account = await stripeClient().accounts.create(params(null), { idempotencyKey: `${key}_ohne_telefon` });
    }
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

  async isReplaceableLegacyAccount(accountId, driverId) {
    const account = await stripeClient().accounts.retrieve(accountId);
    return stripeAccountReplaceable(account, driverId);
  },

  async payoutInterval(accountId) {
    // Nur ein Hinweis in der Oberfläche: kurz warten, nicht wiederholen.
    const account = await stripeClient().accounts.retrieve(accountId, {}, { timeout: 4000, maxNetworkRetries: 0 });
    return account.settings?.payouts?.schedule?.interval === "manual" ? "manual" : "automatic";
  },
};
