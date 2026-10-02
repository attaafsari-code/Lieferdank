import Stripe from "stripe";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { getDb } from "@/lib/db";
import type { User } from "@/lib/db/types";
import { splitTip } from "@/lib/money";
import type { ServiceError } from "@/server/errors";
import { demoPaymentProvider } from "@/server/payments/demo";
import { customerHistory } from "@/server/services/favorites";
import { reconcileTipRefund, refundTip } from "@/server/services/refunds";
import { getDriverStats, getPlatformStats } from "@/server/services/stats";
import { confirmPayment, startTip } from "@/server/services/thanks";
import { freshDb, makeCustomer, makeDriver } from "./helpers";
import { stripeRefundFake, type StripeRefundFake } from "./stripe-refund-fake";

const CONNECT_SECRET = "whsec_test_connect";
const raw = { type: "api_error" as const, message: "fake" };

function signed(payload: object) {
  const body = JSON.stringify(payload);
  return new Request("http://localhost/api/webhooks/stripe", { method: "POST", body,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: body, secret: CONNECT_SECRET }) } });
}

let stripe: StripeRefundFake;
let spies: ReturnType<StripeRefundFake["install"]>;

function useStripe(options: Parameters<typeof stripeRefundFake>[0] = {}) {
  stripe = stripeRefundFake(options);
  spies = stripe.install();
}

beforeEach(() => {
  freshDb();
  for (const level of ["info", "warn", "error"] as const) vi.spyOn(console, level).mockImplementation(() => undefined);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_platform");
  vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", CONNECT_SECRET);
  useStripe();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

/** Ein über Stripe bezahltes Trinkgeld als Direct Charge auf dem Zustellerkonto. */
async function paidTip(gross = 300, customerId: string | null = null) {
  const { driver } = await makeDriver();
  const { paymentId, tipId } = await startTip(driver.code, gross, customerId);
  const db = getDb();
  await db.payments.update(paymentId, { provider: "stripe", providerPaymentId: `cs_${paymentId}` });
  await db.tips.update(tipId, { destinationAccountId: "acct_driver" });
  const intent = `pi_${paymentId}`;
  stripe.addCharge({ intentId: intent, account: "acct_driver", amount: gross, fee: splitTip(gross).platformGrossFeeCents,
    metadata: { paymentId, purpose: "tip", referenceId: tipId } });
  await confirmPayment(paymentId, { providerIntentId: intent });
  return { driver, paymentId, tipId, intent };
}

async function makeAdmin(): Promise<User> {
  const user = await makeCustomer();
  await getDb().users.update(user.id, { role: "admin" });
  return (await getDb().users.get(user.id))!;
}

async function rejection(promise: Promise<unknown>): Promise<ServiceError> {
  try { await promise; } catch (error) { return error as ServiceError; }
  throw new Error("Erwartete Ablehnung blieb aus.");
}

const tipOf = async (id: string) => (await getDb().tips.get(id))!;
const paymentOf = async (id: string) => (await getDb().payments.get(id))!;

describe("Erstattung über Lieferdank (Admin)", () => {
  it("Vollrefund: Kunde bekommt alles zurück, Lieferdank die ganze Gebühr – nichts bleibt", async () => {
    const admin = await makeAdmin();
    const { driver, paymentId, tipId, intent } = await paidTip(300);
    const tip = await refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 0, reason: "Kunde hat sich vertippt" });

    expect(spies.refundsCreate).toHaveBeenCalledTimes(1);
    expect(spies.refundsCreate).toHaveBeenCalledWith(
      { payment_intent: intent, amount: 300, refund_application_fee: true, metadata: { paymentId, source: "lieferdank" } },
      { idempotencyKey: `ld_refund_${paymentId}_from_0`, stripeAccount: "acct_driver" },
    );
    // Stripe hat die Gebühr mit refund_application_fee schon ganz zurückgegeben – nichts nachzuholen.
    expect(spies.feeRefund).not.toHaveBeenCalled();
    expect(tip).toMatchObject({ paymentStatus: "refunded", refundedCents: 300, feeRefundedCents: 60 });
    expect(await paymentOf(paymentId)).toMatchObject({ status: "refunded", refundedAmountCents: 300, failureReason: null });
    expect(stripe.balances(intent)).toEqual({ customerRefunded: 300, driver: 0, lieferdank: 0 });

    const stats = await getDriverStats(driver.id);
    expect(stats.driverShareBeforeStripeCents).toBe(0);
    expect(stats.total.tipCount).toBe(0);
    const platform = await getPlatformStats();
    expect(platform).toMatchObject({ grossTipVolumeCents: 0, grossPlatformFeeCents: 0, tipCount: 0 });

    const log = await getDb().adminActions.findMany({ where: { targetId: tipId } });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ actorEmail: admin.email, action: "tip_refund_requested" });
    expect(log[0].reason).toContain("Kunde hat sich vertippt");

    // Der Webhook zur eigenen Erstattung ändert nichts mehr, ein zweiter Auftrag wird abgelehnt.
    expect((await POST(signed(stripe.refundEvent(intent)))).status).toBe(200);
    expect(await tipOf(tipId)).toMatchObject({ paymentStatus: "refunded", refundedCents: 300, feeRefundedCents: 60 });
    expect((await rejection(refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 300, reason: "nochmal" }))).code).toBe("not_refundable");
    expect(stripe.executed.refunds).toHaveLength(1);
    expect(spies.feeRefund).not.toHaveBeenCalled();
  });

  it("Teilrefund: nur der erstattete Anteil mindert Einnahmen des Zustellers und Lieferdank-Gebühr", async () => {
    const admin = await makeAdmin();
    const customer = await makeCustomer();
    const { driver, paymentId, tipId, intent } = await paidTip(300, customer.id);
    const tip = await refundTip(admin, tipId, { amountCents: 100, expectedRefundedCents: 0, reason: "Teil zurück" });

    // 100 von 300 → 20 der 60 Cent Gebühr zurück. Der Zusteller trägt 80.
    expect(tip).toMatchObject({ paymentStatus: "succeeded", refundedCents: 100, feeRefundedCents: 20 });
    expect(await paymentOf(paymentId)).toMatchObject({ status: "succeeded", refundedAmountCents: 100 });
    expect(stripe.balances(intent)).toEqual({ customerRefunded: 100, driver: 160, lieferdank: 40 });
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(160);
    expect(await getPlatformStats()).toMatchObject({ grossTipVolumeCents: 200, grossPlatformFeeCents: 40, tipCount: 1 });
    expect((await customerHistory(customer.id)).totalTipCents).toBe(200);
  });

  it("mehrere Teilrefunds bis zum Vollrefund – jeder auf dem gesehenen Stand", async () => {
    const admin = await makeAdmin();
    const { driver, paymentId, tipId, intent } = await paidTip(500);
    await refundTip(admin, tipId, { amountCents: 100, expectedRefundedCents: 0, reason: "a" });
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 100, feeRefundedCents: 20, paymentStatus: "succeeded" });
    await refundTip(admin, tipId, { amountCents: 150, expectedRefundedCents: 100, reason: "b" });
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 250, feeRefundedCents: 50, paymentStatus: "succeeded" });
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(400 - 250 + 50);
    await refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 250, reason: "Rest" });

    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 500, feeRefundedCents: 100, paymentStatus: "refunded" });
    expect(await paymentOf(paymentId)).toMatchObject({ status: "refunded", refundedAmountCents: 500 });
    expect(stripe.executed.refunds.map((r) => r.amount)).toEqual([100, 150, 250]);
    expect(spies.refundsCreate.mock.calls.map((call) => ((call as unknown[])[1] as Stripe.RequestOptions).idempotencyKey)).toEqual([
      `ld_refund_${paymentId}_from_0`, `ld_refund_${paymentId}_from_100`, `ld_refund_${paymentId}_from_250`,
    ]);
    expect(stripe.balances(intent)).toEqual({ customerRefunded: 500, driver: 0, lieferdank: 0 });
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
  });

  it("rundet die Gebühr anteilig ab und holt nur Stripes Rundungsfehlbetrag nach", async () => {
    useStripe({ feeRounding: "floor" });
    const admin = await makeAdmin();
    const { paymentId, tipId, intent } = await paidTip(300);
    await refundTip(admin, tipId, { amountCents: 7, expectedRefundedCents: 0, reason: "a" }); // 60·7/300 = 1,4 → 1
    await refundTip(admin, tipId, { amountCents: 7, expectedRefundedCents: 7, reason: "b" }); // Stripe 1, kumuliert 2,8 → 2
    expect(spies.feeRefund).not.toHaveBeenCalled();
    await refundTip(admin, tipId, { amountCents: 1, expectedRefundedCents: 14, reason: "c" }); // Stripe 0, kumuliert 3 → 1 fehlt
    expect(spies.feeRefund).toHaveBeenCalledTimes(1);
    expect(spies.feeRefund).toHaveBeenCalledWith(stripe.charges.get(intent)!.feeId,
      { amount: 1, metadata: { paymentId, source: "lieferdank" } }, { idempotencyKey: `ld_fee_refund_${paymentId}_from_2` });
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 15, feeRefundedCents: 3 });
    await refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 15, reason: "Rest" });
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 60, paymentStatus: "refunded" });
    expect(stripe.balances(intent)).toEqual({ customerRefunded: 300, driver: 0, lieferdank: 0 });
  });

  it("prüft Grund, Betrag, Zahlungsstatus und Stripe-Stand, bevor Geld bewegt wird", async () => {
    const admin = await makeAdmin();
    const { paymentId, tipId } = await paidTip(300);
    const attempt = (request: Partial<Parameters<typeof refundTip>[2]>) =>
      rejection(refundTip(admin, tipId, { amountCents: 100, expectedRefundedCents: 0, reason: "Grund", ...request }));
    expect((await attempt({ reason: "   " })).code).toBe("reason_required");
    for (const amountCents of [0, -5, 1.5, 301, Number.NaN]) expect((await attempt({ amountCents })).code).toBe("invalid_amount");
    expect((await attempt({ expectedRefundedCents: -1 })).code).toBe("invalid_amount");
    expect(stripe.executed.refunds).toHaveLength(0);

    // Stripe kennt eine andere Zahlung (Betrag weicht ab) → nichts erstatten, nichts verbuchen.
    stripe.charges.get(`pi_${paymentId}`)!.amount = 500;
    expect((await attempt({})).code).toBe("refund_unavailable");
    expect(spies.refundsCreate).not.toHaveBeenCalled();
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 0, feeRefundedCents: 0, paymentStatus: "succeeded" });

    const { tipId: pendingTip } = await (async () => {
      const { driver } = await makeDriver();
      return startTip(driver.code, 300, null);
    })();
    expect((await rejection(refundTip(admin, pendingTip, { amountCents: null, expectedRefundedCents: 0, reason: "x" }))).code).toBe("not_refundable");
    expect((await rejection(refundTip(admin, crypto.randomUUID(), { amountCents: null, expectedRefundedCents: 0, reason: "x" }))).code).toBe("not_found");
  });
});

describe("Erstattung direkt in Stripe (Zusteller-Dashboard)", () => {
  it("holt die anteilige Gebühr nach – auf dem Plattformkonto, mit Schlüssel auf den gelesenen Stand", async () => {
    const admin = await makeAdmin();
    const { driver, paymentId, tipId, intent } = await paidTip(300);
    stripe.externalRefund(intent, 150);
    expect((await POST(signed(stripe.refundEvent(intent)))).status).toBe(200);

    expect(spies.feeRefund).toHaveBeenCalledTimes(1);
    expect(spies.feeRefund).toHaveBeenCalledWith(stripe.charges.get(intent)!.feeId,
      { amount: 30, metadata: { paymentId, source: "lieferdank" } }, { idempotencyKey: `ld_fee_refund_${paymentId}_from_0` });
    // Die Gebühr wird ohne Stripe-Account-Header gelesen – sie gehört der Plattform.
    expect(spies.feeRetrieve).toHaveBeenCalled();
    expect(spies.feeRetrieve.mock.calls.every((call) => call.length === 1)).toBe(true);
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 150, feeRefundedCents: 30, paymentStatus: "succeeded" });
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(240 - 150 + 30);

    // Den Rest erstattet danach Lieferdank: Stripe gibt dabei die restliche Gebühr selbst zurück.
    await refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 150, reason: "Rest" });
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 60, paymentStatus: "refunded" });
    expect(spies.feeRefund).toHaveBeenCalledTimes(1);
    expect(stripe.balances(intent)).toEqual({ customerRefunded: 300, driver: 0, lieferdank: 0 });
  });

  it("gibt bei bereits teilweise zurückgegebener Gebühr nur den fehlenden Teil zurück – und nie etwas zurückgeholt", async () => {
    const { paymentId, tipId, intent } = await paidTip(300);
    stripe.manualFeeRefund(intent, 10); // von Hand im Plattform-Dashboard
    stripe.externalRefund(intent, 150);
    expect((await POST(signed(stripe.refundEvent(intent)))).status).toBe(200);
    expect(spies.feeRefund).toHaveBeenCalledWith(expect.any(String),
      { amount: 20, metadata: { paymentId, source: "lieferdank" } }, { idempotencyKey: `ld_fee_refund_${paymentId}_from_10` });
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 150, feeRefundedCents: 30 });

    // Mehr als anteilig zurückgegeben: nichts nachholen, nichts zurückholen.
    const second = await paidTip(300);
    stripe.manualFeeRefund(second.intent, 50);
    stripe.externalRefund(second.intent, 150);
    expect((await POST(signed(stripe.refundEvent(second.intent)))).status).toBe(200);
    expect(await tipOf(second.tipId)).toMatchObject({ refundedCents: 150, feeRefundedCents: 50, paymentStatus: "succeeded" });
    expect(spies.feeRefund).toHaveBeenCalledTimes(1);
    // Bei vollständiger Erstattung folgt nur noch der Rest.
    stripe.externalRefund(second.intent, 150);
    expect((await POST(signed(stripe.refundEvent(second.intent)))).status).toBe(200);
    expect(spies.feeRefund).toHaveBeenLastCalledWith(expect.any(String),
      { amount: 10, metadata: { paymentId: second.paymentId, source: "lieferdank" } }, { idempotencyKey: `ld_fee_refund_${second.paymentId}_from_50` });
    expect(await tipOf(second.tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 60, paymentStatus: "refunded" });
  });

  it("verarbeitet wiederholte Webhooks genau einmal", async () => {
    const { tipId, intent } = await paidTip(500);
    stripe.externalRefund(intent, 500);
    const event = stripe.refundEvent(intent);
    for (let i = 0; i < 5; i++) expect((await POST(signed(event))).status).toBe(200);
    expect(spies.feeRefund).toHaveBeenCalledTimes(1);
    expect(stripe.executed.feeRefunds).toEqual([{ intentId: intent, amount: 100 }]);
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 500, feeRefundedCents: 100, paymentStatus: "refunded" });
  });

  it("senkt bei veraltetem Stand (ungeordnete Webhooks, langsamer Abgleich) nie etwas ab", async () => {
    const { paymentId, tipId, intent } = await paidTip(300);
    stripe.externalRefund(intent, 100);
    const releaseStale = stripe.holdNext("retrieve");
    const stale = reconcileTipRefund(paymentId, intent); // liest 100 und hängt
    await new Promise((resolve) => setTimeout(resolve, 0));
    stripe.externalRefund(intent, 100);
    await reconcileTipRefund(paymentId, intent); // liest 200 und gibt 40 zurück
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 200, feeRefundedCents: 40 });
    releaseStale();
    await stale;
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 200, feeRefundedCents: 40, paymentStatus: "succeeded" });
    expect(await paymentOf(paymentId)).toMatchObject({ refundedAmountCents: 200 });
    expect(stripe.executed.feeRefunds).toEqual([{ intentId: intent, amount: 40 }]);
  });

  it("überschreibt eine inzwischen höhere Gebührenrückgabe nicht mit einem veralteten Stand", async () => {
    const { paymentId, tipId, intent } = await paidTip(300);
    stripe.manualFeeRefund(intent, 30);
    stripe.externalRefund(intent, 150); // anteilig 30 – schon zurückgegeben
    const releaseStale = stripe.holdNext("feeRetrieve");
    const stale = reconcileTipRefund(paymentId, intent); // liest 150/30 und hängt
    await new Promise((resolve) => setTimeout(resolve, 0));
    stripe.manualFeeRefund(intent, 20);
    await reconcileTipRefund(paymentId, intent); // verbucht 150/50
    releaseStale();
    await stale;
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 150, feeRefundedCents: 50 });
    expect(spies.feeRefund).not.toHaveBeenCalled();
  });
});

describe("Gleichzeitige Aufträge", () => {
  it("Doppelklick: zwei gleiche Aufträge parallel erstatten genau einmal", async () => {
    const admin = await makeAdmin();
    const { tipId, intent } = await paidTip(300);
    const request = { amountCents: 100, expectedRefundedCents: 0, reason: "Doppelklick" };
    const results = await Promise.allSettled([refundTip(admin, tipId, request), refundTip(admin, tipId, request)]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    for (const r of results) if (r.status === "rejected") expect((r.reason as ServiceError).code).toBe("stale");
    expect(stripe.executed.refunds).toEqual([{ intentId: intent, amount: 100, withFee: true }]);
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 100, feeRefundedCents: 20 });

    // Wiederholung desselben Auftrags nach dem Neuladen: Stand ist jetzt 100 → abgelehnt, nichts erstattet.
    expect((await rejection(refundTip(admin, tipId, request))).code).toBe("stale");
    expect(stripe.executed.refunds).toHaveLength(1);
  });

  it("zwei Tabs mit verschiedenen Beträgen auf denselben Stand: höchstens eine Erstattung", async () => {
    const admin = await makeAdmin();
    const { tipId, intent } = await paidTip(300);
    const results = await Promise.allSettled([
      refundTip(admin, tipId, { amountCents: 100, expectedRefundedCents: 0, reason: "Tab 1" }),
      refundTip(admin, tipId, { amountCents: 50, expectedRefundedCents: 0, reason: "Tab 2" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(["refund_failed", "stale"]).toContain((rejected.reason as ServiceError).code);
    expect(stripe.executed.refunds).toHaveLength(1);
    const tip = await tipOf(tipId);
    expect(tip.refundedCents).toBe(stripe.charges.get(intent)!.refunded);
  });

  it("parallele Abgleiche (Webhook, Wiederholung, Admin-Seite) geben die Gebühr genau einmal zurück", async () => {
    const { paymentId, tipId, intent } = await paidTip(300);
    stripe.externalRefund(intent, 300);
    await Promise.all([reconcileTipRefund(paymentId, intent), reconcileTipRefund(paymentId, intent), reconcileTipRefund(paymentId)]);
    expect(stripe.executed.feeRefunds).toEqual([{ intentId: intent, amount: 60 }]);
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 60, paymentStatus: "refunded" });
  });

  it("verschiedene gelesene Stände während einer laufenden Gebührenrückgabe: nie mehr als der anteilige Betrag", async () => {
    const { paymentId, tipId, intent } = await paidTip(300);
    stripe.externalRefund(intent, 150);
    const release = stripe.holdNext("feeRefund");
    const first = reconcileTipRefund(paymentId, intent); // will 30 zurückgeben, Schlüssel _from_0 läuft
    await new Promise((resolve) => setTimeout(resolve, 0));
    stripe.externalRefund(intent, 150);
    // Liest 300/0 und will 60 mit demselben Schlüssel – Stripe weist das ab, solange der erste läuft.
    await expect(reconcileTipRefund(paymentId, intent)).rejects.toThrow();
    release();
    await first;
    expect(stripe.executed.feeRefunds).toEqual([{ intentId: intent, amount: 30 }]);
    // Die Wiederholung (Stripe stellt den Webhook erneut zu) holt den Rest nach.
    expect((await POST(signed(stripe.refundEvent(intent)))).status).toBe(200);
    expect(stripe.executed.feeRefunds).toEqual([{ intentId: intent, amount: 30 }, { intentId: intent, amount: 30 }]);
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 60, paymentStatus: "refunded" });
  });

  it("weist einen Auftrag auf veraltetem Stand ab und verbucht den neuen Stand", async () => {
    const admin = await makeAdmin();
    const { tipId, intent } = await paidTip(300);
    stripe.externalRefund(intent, 100); // Webhook noch nicht da – die Admin-Seite zeigt 0
    expect((await rejection(refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 0, reason: "x" }))).code).toBe("stale");
    expect(spies.refundsCreate).not.toHaveBeenCalled();
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 100, feeRefundedCents: 20 });
  });
});

describe("Stripe-Fehler und Berechtigungen", () => {
  it("erstattet nichts, wenn der Stand bei Stripe nicht lesbar ist", async () => {
    const admin = await makeAdmin();
    const { tipId } = await paidTip(300);
    stripe.fail("retrieve", new Stripe.errors.StripeConnectionError(raw));
    expect((await rejection(refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 0, reason: "x" }))).code).toBe("refund_unavailable");
    expect(spies.refundsCreate).not.toHaveBeenCalled();
    expect(await getDb().adminActions.count()).toBe(0);
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 0, paymentStatus: "succeeded" });
  });

  it("bei Netzwerkfehler der Erstattung: nichts verbucht, Wiederholung erstattet genau einmal", async () => {
    const admin = await makeAdmin();
    const { tipId, intent } = await paidTip(300);
    stripe.fail("refund", new Stripe.errors.StripeConnectionError(raw));
    const request = { amountCents: 100, expectedRefundedCents: 0, reason: "x" };
    expect((await rejection(refundTip(admin, tipId, request))).code).toBe("refund_failed");
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 0, paymentStatus: "succeeded" });
    expect(stripe.executed.refunds).toHaveLength(0);
    await refundTip(admin, tipId, request);
    expect(stripe.executed.refunds).toEqual([{ intentId: intent, amount: 100, withFee: true }]);
  });

  it("Erstattung ausgeführt, Verbuchung gescheitert: der Abgleich holt es nach, kein zweiter Refund", async () => {
    const admin = await makeAdmin();
    const { tipId, intent } = await paidTip(300);
    // Der erste Abruf (Prüfung vorab) gelingt, der Abruf nach der Erstattung scheitert.
    stripe.fail("retrieve", undefined);
    stripe.fail("retrieve", new Stripe.errors.StripeAPIError(raw));
    const request = { amountCents: null, expectedRefundedCents: 0, reason: "x" };
    expect((await rejection(refundTip(admin, tipId, request))).code).toBe("refund_sync_pending");
    expect(stripe.executed.refunds).toHaveLength(1);
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 0, paymentStatus: "succeeded" });
    // Ein erneuter Klick auf dem alten Stand erstattet nicht noch einmal, sondern verbucht den Stand.
    expect((await rejection(refundTip(admin, tipId, request))).code).toBe("stale");
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 60, paymentStatus: "refunded" });
    expect((await POST(signed(stripe.refundEvent(intent)))).status).toBe(200);
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 60, paymentStatus: "refunded" });
    expect(stripe.executed.refunds).toHaveLength(1);
  });

  it("scheitert die Gebührenrückgabe, bleibt der Stand verbucht und Stripe stellt erneut zu", async () => {
    const { paymentId, tipId, intent } = await paidTip(300);
    stripe.externalRefund(intent, 300);
    stripe.fail("feeRefund", new Stripe.errors.StripeAPIError(raw));
    const event = stripe.refundEvent(intent);
    expect((await POST(signed(event))).status).toBe(500);
    // Erstattung ist verbucht (Zusteller trägt sie gerade ganz), die Gebühr noch nicht zurück.
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 0, paymentStatus: "succeeded" });
    const events = await getDb().systemEvents.findMany({ where: { source: "refund" } });
    expect(events.some((e) => e.level === "error" && e.context?.paymentId === paymentId)).toBe(true);
    expect((await POST(signed(event))).status).toBe(200);
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 60, paymentStatus: "refunded" });
    expect(stripe.executed.feeRefunds).toEqual([{ intentId: intent, amount: 60 }]);
  });

  it("fehlende Stripe-Berechtigung: keine Erstattung, keine Buchung; Gebührenrückgabe wird wiederholt", async () => {
    const admin = await makeAdmin();
    const { tipId, intent } = await paidTip(300);
    stripe.fail("refund", new Stripe.errors.StripePermissionError({ ...raw, type: "invalid_request_error", statusCode: 403 }));
    expect((await rejection(refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 0, reason: "x" }))).code).toBe("refund_failed");
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 0, paymentStatus: "succeeded" });

    stripe.externalRefund(intent, 300);
    stripe.fail("feeRefund", new Stripe.errors.StripePermissionError({ ...raw, type: "invalid_request_error", statusCode: 403 }));
    expect((await POST(signed(stripe.refundEvent(intent)))).status).toBe(500);
    expect((await tipOf(tipId)).feeRefundedCents).toBe(0);
  });

  it("nur aktive Admins dürfen erstatten", async () => {
    const { user: driverUser } = await makeDriver();
    const customer = await makeCustomer();
    const blocked = await makeAdmin();
    await getDb().users.update(blocked.id, { blockedAt: new Date().toISOString() });
    const { tipId } = await paidTip(300);
    for (const actor of [driverUser, customer, (await getDb().users.get(blocked.id))!]) {
      const error = await rejection(refundTip(actor, tipId, { amountCents: null, expectedRefundedCents: 0, reason: "x" }));
      expect(error.code).toBe("forbidden");
      expect(error.status).toBe(403);
    }
    expect(spies.intentRetrieve).not.toHaveBeenCalled();
    expect(spies.refundsCreate).not.toHaveBeenCalled();

    // Die Server Action prüft die Sitzung selbst, bevor sie den Dienst aufruft.
    const actions = readFileSync(path.resolve(import.meta.dirname, "../src/server/actions/admin.ts"), "utf8");
    const body = actions.slice(actions.indexOf("export async function refundTipAction"));
    expect(body.indexOf("await requireAdmin()")).toBeGreaterThan(-1);
    expect(body.indexOf("await requireAdmin()")).toBeLessThan(body.indexOf("refundTip(user"));
  });
});

describe("Rückbuchungen bleiben manuell", () => {
  it("keine Admin-Erstattung bei laufender Rückbuchung", async () => {
    const admin = await makeAdmin();
    const { tipId, intent } = await paidTip(300);
    stripe.dispute(intent);
    expect((await rejection(refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 0, reason: "x" }))).code).toBe("disputed");
    expect(spies.refundsCreate).not.toHaveBeenCalled();
  });

  it("verbucht Erstattungen an strittigen oder geprüften Zahlungen, bewegt aber keine Gebühr", async () => {
    const disputed = await paidTip(300);
    stripe.dispute(disputed.intent);
    stripe.externalRefund(disputed.intent, 300);
    expect((await POST(signed(stripe.refundEvent(disputed.intent)))).status).toBe(200);
    expect(await tipOf(disputed.tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 0 });

    const reviewed = await paidTip(300);
    const disputeEvent = { id: "evt_dispute", account: "acct_driver", type: "charge.dispute.created",
      data: { object: { id: "du_1", payment_intent: reviewed.intent } } };
    expect((await POST(signed(disputeEvent))).status).toBe(200);
    expect((await paymentOf(reviewed.paymentId)).status).toBe("review_required");
    stripe.externalRefund(reviewed.intent, 100);
    expect((await POST(signed(stripe.refundEvent(reviewed.intent)))).status).toBe(200);
    expect(await tipOf(reviewed.tipId)).toMatchObject({ refundedCents: 100, feeRefundedCents: 0, paymentStatus: "review_required" });
    expect((await paymentOf(reviewed.paymentId)).status).toBe("review_required");

    expect(spies.feeRefund).not.toHaveBeenCalled();
    expect(stripe.executed.feeRefunds).toHaveLength(0);
  });
});

describe("Testmodus ohne Stripe", () => {
  it("erstattet Testzahlungen mit derselben Logik und ohne Doppel-Erstattung", async () => {
    const admin = await makeAdmin();
    const { driver } = await makeDriver();
    const { paymentId, tipId } = await startTip(driver.code, 300, null);
    await confirmPayment(paymentId);
    await refundTip(admin, tipId, { amountCents: 100, expectedRefundedCents: 0, reason: "Test" });
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 100, feeRefundedCents: 20, paymentStatus: "succeeded" });
    expect((await rejection(refundTip(admin, tipId, { amountCents: 100, expectedRefundedCents: 0, reason: "Test" }))).code).toBe("stale");
    // Auch der Testanbieter erstattet pro Stand höchstens einmal.
    const again = { providerIntentId: paymentId, amountCents: 100, expectedRefundedCents: 0 };
    await demoPaymentProvider.refundPayment(again);
    await expect(demoPaymentProvider.refundPayment({ ...again, amountCents: 50 })).rejects.toThrow();
    expect((await demoPaymentProvider.refundState(paymentId)).refundedCents).toBe(100);
    await refundTip(admin, tipId, { amountCents: null, expectedRefundedCents: 100, reason: "Rest" });
    expect(await tipOf(tipId)).toMatchObject({ refundedCents: 300, feeRefundedCents: 60, paymentStatus: "refunded" });
    expect(spies.refundsCreate).not.toHaveBeenCalled();
  });
});
