import Stripe from "stripe";
import { vi } from "vitest";
import { stripeClient } from "@/server/payments/stripe";

/**
 * Zustandsbehafteter Nachbau der Stripe-Teile, die Erstattungen berühren: Direct Charge auf dem
 * Zustellerkonto, Application Fee auf dem Plattformkonto, Refunds mit und ohne
 * refund_application_fee, Gebührenrückgaben und Idempotenzschlüssel wie bei Stripe
 * (gleicher Schlüssel + gleiche Parameter → dasselbe Ergebnis, abweichende Parameter → Fehler,
 * Schlüssel noch in Arbeit → Konflikt).
 */

type FakeCharge = {
  intentId: string;
  chargeId: string;
  feeId: string;
  account: string;
  amount: number;
  fee: number;
  refunded: number;
  feeRefunded: number;
  disputed: boolean;
  metadata: Record<string, string>;
};

type Gate = { promise: Promise<void>; release: () => void };

const raw = { type: "invalid_request_error" as const, message: "fake" };

export function stripeRefundFake(options: { feeRounding?: "floor" | "round" } = {}) {
  const rounding = options.feeRounding === "floor" ? Math.floor : Math.round;
  const charges = new Map<string, FakeCharge>();
  const keys = new Map<string, { params: string; inFlight: boolean; result?: unknown; error?: unknown }>();
  const failures: Record<"refund" | "feeRefund" | "retrieve" | "feeRetrieve", unknown[]> = { refund: [], feeRefund: [], retrieve: [], feeRetrieve: [] };
  const gates: Record<"feeRefund" | "retrieve" | "feeRetrieve", Gate[]> = { feeRefund: [], retrieve: [], feeRetrieve: [] };
  /** Tatsächlich ausgeführte Geldbewegungen (keine Idempotenz-Wiederholungen). */
  const executed = { refunds: [] as { intentId: string; amount: number; withFee: boolean }[], feeRefunds: [] as { intentId: string; amount: number }[] };
  let counter = 0;

  function byIntent(intentId: string, stripeAccount: string | undefined): FakeCharge {
    const charge = charges.get(intentId);
    // Direct Charges sind nur unter dem Zustellerkonto sichtbar.
    if (!charge || charge.account !== stripeAccount) {
      throw new Stripe.errors.StripeInvalidRequestError({ ...raw, code: "resource_missing", statusCode: 404 });
    }
    return charge;
  }

  function byFee(feeId: string, stripeAccount: string | undefined): FakeCharge {
    const charge = [...charges.values()].find((c) => c.feeId === feeId);
    // Die Application Fee gehört der Plattform – unter dem Zustellerkonto gibt es sie nicht.
    if (!charge || stripeAccount) throw new Stripe.errors.StripeInvalidRequestError({ ...raw, code: "resource_missing", statusCode: 404 });
    return charge;
  }

  /** Stripe-Idempotenz: Ergebnisse (auch Fehler aus der Ausführung) werden pro Schlüssel gemerkt. */
  async function idempotent<T>(key: string | undefined, params: unknown, gate: Gate | undefined, run: () => T): Promise<T> {
    if (!key) return run();
    const serialized = JSON.stringify(params);
    const known = keys.get(key);
    if (known) {
      if (known.inFlight) throw new Stripe.errors.StripeIdempotencyError({ ...raw, type: "idempotency_error", statusCode: 409 });
      if (known.params !== serialized) throw new Stripe.errors.StripeIdempotencyError({ ...raw, type: "idempotency_error", statusCode: 400 });
      if (known.error) throw known.error;
      return known.result as T;
    }
    const entry: { params: string; inFlight: boolean; result?: unknown; error?: unknown } = { params: serialized, inFlight: true };
    keys.set(key, entry);
    if (gate) await gate.promise;
    entry.inFlight = false;
    try {
      entry.result = run();
      return entry.result as T;
    } catch (error) {
      entry.error = error;
      throw error;
    }
  }

  function takeFailure(kind: keyof typeof failures) {
    const failure = failures[kind].shift();
    if (failure) throw failure;
  }

  function chargeObject(charge: FakeCharge) {
    return {
      id: charge.chargeId, object: "charge", amount: charge.amount, amount_refunded: charge.refunded, currency: "eur",
      application_fee: charge.feeId, application_fee_amount: charge.fee, disputed: charge.disputed, payment_intent: charge.intentId,
      refunded: charge.refunded === charge.amount,
    };
  }

  const fake = {
    charges,
    executed,
    keys,

    /** Eine bezahlte Direct Charge mit Application Fee anlegen. */
    addCharge(input: { intentId: string; account: string; amount: number; fee: number; metadata: Record<string, string> }) {
      counter += 1;
      charges.set(input.intentId, {
        ...input, chargeId: `ch_${counter}`, feeId: `fee_${counter}`, refunded: 0, feeRefunded: 0, disputed: false,
      });
    },

    /** Erstattung im Stripe-Dashboard des Zustellers: ohne Gebührenrückgabe. */
    externalRefund(intentId: string, amount: number) {
      const charge = charges.get(intentId)!;
      if (charge.refunded + amount > charge.amount) throw new Error("fake: Erstattung zu hoch");
      charge.refunded += amount;
      executed.refunds.push({ intentId, amount, withFee: false });
    },

    /** Gebührenrückgabe von Hand im Stripe-Dashboard der Plattform. */
    manualFeeRefund(intentId: string, amount: number) {
      const charge = charges.get(intentId)!;
      if (charge.feeRefunded + amount > charge.fee) throw new Error("fake: Gebührenrückgabe zu hoch");
      charge.feeRefunded += amount;
      executed.feeRefunds.push({ intentId, amount });
    },

    dispute(intentId: string) { charges.get(intentId)!.disputed = true; },

    fail(kind: keyof typeof failures, error: unknown) { failures[kind].push(error); },

    /**
     * Hält den nächsten Aufruf an: eine Gebührenrückgabe, nachdem Stripe den Schlüssel angenommen
     * hat; einen Abruf von PaymentIntent oder Gebühr, nachdem der Stand gelesen wurde (er kommt
     * also veraltet an).
     */
    holdNext(kind: keyof typeof gates): () => void {
      let release!: () => void;
      const promise = new Promise<void>((done) => { release = done; });
      gates[kind].push({ promise, release });
      return release;
    },

    /** Ein charge.refunded-Ereignis mit dem Snapshot zum jetzigen Zeitpunkt. */
    refundEvent(intentId: string, id = `evt_refund_${++counter}`) {
      const charge = charges.get(intentId)!;
      return { id, object: "event", account: charge.account, type: "charge.refunded", data: { object: chargeObject(charge) } };
    },

    /** Was Zusteller und Lieferdank aus der Zahlung nach allen Erstattungen halten (vor Stripe-Kosten). */
    balances(intentId: string) {
      const charge = charges.get(intentId)!;
      return {
        customerRefunded: charge.refunded,
        driver: charge.amount - charge.fee - charge.refunded + charge.feeRefunded,
        lieferdank: charge.fee - charge.feeRefunded,
      };
    },

    install() {
      const client = stripeClient();
      const refundsCreate = vi.spyOn(client.refunds, "create").mockImplementation((async (params: Stripe.RefundCreateParams, opts?: Stripe.RequestOptions) => {
        takeFailure("refund");
        const charge = byIntent(params.payment_intent as string, opts?.stripeAccount);
        return idempotent(opts?.idempotencyKey, { params, account: opts?.stripeAccount }, undefined, () => {
          const amount = params.amount ?? charge.amount - charge.refunded;
          if (amount <= 0 || charge.refunded + amount > charge.amount) {
            throw new Stripe.errors.StripeInvalidRequestError({ ...raw, code: "charge_already_refunded", statusCode: 400 });
          }
          charge.refunded += amount;
          let feeBack = 0;
          if (params.refund_application_fee) {
            // Wie Stripe: anteilig zum erstatteten Betrag, bei vollständiger Erstattung der Rest.
            feeBack = charge.refunded === charge.amount
              ? charge.fee - charge.feeRefunded
              : Math.min(charge.fee - charge.feeRefunded, rounding((charge.fee * amount) / charge.amount));
            charge.feeRefunded += feeBack;
            if (feeBack > 0) executed.feeRefunds.push({ intentId: charge.intentId, amount: feeBack });
          }
          executed.refunds.push({ intentId: charge.intentId, amount, withFee: Boolean(params.refund_application_fee) });
          return { id: `re_${++counter}`, object: "refund", amount, status: "succeeded", payment_intent: charge.intentId };
        });
      }) as never);

      const intentRetrieve = vi.spyOn(client.paymentIntents, "retrieve").mockImplementation((async (
        id: string, params?: Stripe.PaymentIntentRetrieveParams, opts?: Stripe.RequestOptions,
      ) => {
        takeFailure("retrieve");
        const charge = byIntent(id, opts?.stripeAccount);
        const expanded = params?.expand?.includes("latest_charge");
        const snapshot = {
          id, object: "payment_intent", status: "succeeded", amount: charge.amount, currency: "eur",
          application_fee_amount: charge.fee, metadata: charge.metadata,
          latest_charge: expanded ? chargeObject(charge) : charge.chargeId,
        };
        const gate = gates.retrieve.shift();
        if (gate) await gate.promise;
        return snapshot;
      }) as never);

      const feeRetrieve = vi.spyOn(client.applicationFees, "retrieve").mockImplementation((async (
        id: string, _params?: unknown, opts?: Stripe.RequestOptions,
      ) => {
        takeFailure("feeRetrieve");
        const charge = byFee(id, opts?.stripeAccount);
        const snapshot = { id, object: "application_fee", amount: charge.fee, amount_refunded: charge.feeRefunded, refunded: charge.feeRefunded === charge.fee };
        const gate = gates.feeRetrieve.shift();
        if (gate) await gate.promise;
        return snapshot;
      }) as never);

      const feeRefund = vi.spyOn(client.applicationFees, "createRefund").mockImplementation((async (
        id: string, params?: Stripe.ApplicationFeeCreateRefundParams, opts?: Stripe.RequestOptions,
      ) => {
        takeFailure("feeRefund");
        const charge = byFee(id, opts?.stripeAccount);
        return idempotent(opts?.idempotencyKey, { id, params }, gates.feeRefund.shift(), () => {
          const amount = params?.amount ?? charge.fee - charge.feeRefunded;
          if (amount <= 0 || charge.feeRefunded + amount > charge.fee) {
            throw new Stripe.errors.StripeInvalidRequestError({ ...raw, statusCode: 400 });
          }
          charge.feeRefunded += amount;
          executed.feeRefunds.push({ intentId: charge.intentId, amount });
          return { id: `fr_${++counter}`, object: "fee_refund", amount, fee: id };
        });
      }) as never);

      return { refundsCreate, intentRetrieve, feeRetrieve, feeRefund };
    },
  };
  return fake;
}

export type StripeRefundFake = ReturnType<typeof stripeRefundFake>;
