import "server-only";
import type { PaymentProvider } from "./types";
import { getDb, isDemoDatabase } from "@/lib/db";
import { proportionalFeeRefundCents } from "@/lib/money";
import { isProductionRuntime } from "@/lib/runtime";

function assertIsolatedDemo(): void {
  if (isProductionRuntime() || (!isDemoDatabase() && process.env.ALLOW_DEMO_SUPABASE_TEST_PROJECT !== "true")) {
    throw new Error("Demo-Zahlungen erfordern eine isolierte Testumgebung.");
  }
}

/** keys: Erstattungsstand → Betrag, wie Stripes Idempotenzschlüssel. */
type DemoRefund = { refundedCents: number; feeRefundedCents: number; keys: Map<number, number> };

/** Erstattungen im Testmodus leben nur im Arbeitsspeicher – wie die Testzahlung selbst. */
function demoLedger(): Map<string, DemoRefund> {
  const g = globalThis as typeof globalThis & { __ldDemoRefunds?: Map<string, DemoRefund> };
  return (g.__ldDemoRefunds ??= new Map());
}

async function demoRefund(reference: string) {
  const db = getDb();
  const payment = (await db.payments.findOne({ providerIntentId: reference })) ?? (await db.payments.get(reference));
  if (!payment || payment.provider !== "demo") throw new Error("Testzahlung für Erstattung nicht gefunden.");
  const tip = payment.purpose === "tip" ? await db.tips.get(payment.referenceId) : null;
  const ledger = demoLedger();
  let entry = ledger.get(payment.id);
  if (!entry) {
    entry = { refundedCents: tip?.refundedCents ?? payment.refundedAmountCents ?? 0, feeRefundedCents: tip?.feeRefundedCents ?? 0, keys: new Map() };
    ledger.set(payment.id, entry);
  }
  return { payment, feeCents: tip?.platformGrossFeeCents ?? 0, entry };
}

/**
 * Testmodus: simuliert den kompletten Zahlungsablauf ohne echtes Geld.
 * Der Kunde landet auf einer nachgebauten Bezahlmaske und kann Erfolg oder
 * Abbruch auslösen – so sind auch Fehlerpfade testbar.
 */
export const demoPaymentProvider: PaymentProvider = {
  id: "demo",
  isSandbox: true,
  methodsLabel: "Testzahlung",

  async createPayment(input) {
    assertIsolatedDemo();
    return { providerPaymentId: `demo_${input.paymentId}`, redirectUrl: `/zahlung/${input.paymentId}` };
  },
  async refundPayment({ providerIntentId, amountCents, expectedRefundedCents }) {
    assertIsolatedDemo();
    const { payment, feeCents, entry } = await demoRefund(providerIntentId);
    const earlier = entry.keys.get(expectedRefundedCents);
    if (earlier === amountCents) return;
    if (earlier !== undefined) throw new Error("Zu diesem Erstattungsstand gibt es bereits eine andere Erstattung.");
    if (amountCents <= 0 || entry.refundedCents + amountCents > payment.amountCents) throw new Error("Erstattung übersteigt die Zahlung.");
    entry.keys.set(expectedRefundedCents, amountCents);
    entry.refundedCents += amountCents;
    // Wie Stripe mit refund_application_fee: anteilig, bei vollständiger Erstattung die ganze Gebühr.
    entry.feeRefundedCents = Math.max(entry.feeRefundedCents, proportionalFeeRefundCents(feeCents, payment.amountCents, entry.refundedCents));
  },
  async refundState(providerIntentId) {
    const { payment, feeCents, entry } = await demoRefund(providerIntentId);
    return {
      amountCents: payment.amountCents, refundedCents: entry.refundedCents, feeCents,
      feeRefundedCents: entry.feeRefundedCents, feeReference: `demo_fee_${payment.id}`, disputed: false,
    };
  },
  async refundPlatformFee({ paymentId, amountCents, alreadyRefundedCents }) {
    assertIsolatedDemo();
    const entry = demoLedger().get(paymentId);
    if (!entry || entry.feeRefundedCents !== alreadyRefundedCents) throw new Error("Gebührenstand hat sich geändert.");
    entry.feeRefundedCents += amountCents;
  },
  async createConnectedAccount({ driverId }) {
    assertIsolatedDemo();
    return `demo_acct_${driverId.slice(0, 8)}`;
  },
  async onboardDriver({ accountId, returnUrl }) {
    assertIsolatedDemo();
    return { accountId, url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}demo_onboarding=ok` };
  },
  async isAccountReady() {
    return true;
  },
  async isReplaceableLegacyAccount() {
    return false;
  },
  async payoutInterval() {
    return "automatic";
  },
};
