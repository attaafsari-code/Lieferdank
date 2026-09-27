import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { getDb } from "@/lib/db";
import { startTip } from "@/server/services/thanks";
import { getDriverStats } from "@/server/services/stats";
import { stripeClient } from "@/server/payments/stripe";
import { freshDb, makeDriver } from "./helpers";

/**
 * Der Webhook ist der einzige Weg, auf dem eine echte Zahlung gutgeschrieben wird.
 * Getestet mit echten Stripe-Signaturen (generiert mit dem Stripe-SDK).
 */
const PLATFORM_SECRET = "whsec_test_plattform";
const CONNECT_SECRET = "whsec_test_connect";

function signed(payload: object, secret: string) {
  const body = JSON.stringify(payload);
  const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body,
  });
}

async function checkoutCompleted(paymentId: string) {
  const db = getDb();
  const payment = (await db.payments.get(paymentId))!;
  await db.payments.update(paymentId, { provider: "stripe", providerPaymentId: `cs_${paymentId}` });
  return {
    id: `evt_${paymentId}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: `cs_${paymentId}`, object: "checkout.session", payment_status: "paid", payment_intent: "pi_123", payment_method_types: ["card"], amount_total: payment.amountCents, currency: "eur", metadata: { paymentId, purpose: payment.purpose, referenceId: payment.referenceId } } },
  };
}

beforeEach(() => {
  freshDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", PLATFORM_SECRET);
  vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", CONNECT_SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("Stripe-Webhook", () => {
  it("bucht eine bezahlte Checkout-Session genau einmal", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);

    const event = await checkoutCompleted(paymentId);
    expect((await POST(signed(event, PLATFORM_SECRET))).status).toBe(200);
    expect((await POST(signed(event, PLATFORM_SECRET))).status).toBe(200);

    const stats = await getDriverStats(driver.id);
    expect(stats.balanceCents).toBe(250);
    expect(stats.total.thanks).toBe(1);
    expect((await getDb().payments.get(paymentId))?.providerIntentId).toBe("pi_123");
  });

  it("weist gefälschte Signaturen ab", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    const response = await POST(signed(await checkoutCompleted(paymentId), "whsec_falsch"));
    expect(response.status).toBe(400);
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });

  it("weist fehlende Signaturen ab", async () => {
    const response = await POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: "{}" }));
    expect(response.status).toBe(400);
  });

  it("akzeptiert Connect-Ereignisse mit dem zweiten Secret", async () => {
    const { driver } = await makeDriver();
    await getDb().driverProfiles.update(driver.id, { payoutAccountId: "acct_1" });
    const event = {
      id: "evt_acct",
      object: "event",
      account: "acct_1",
      type: "account.updated",
      data: { object: { id: "acct_1", object: "account", payouts_enabled: true, details_submitted: true, metadata: { driverId: driver.id } } },
    };
    expect((await POST(signed(event, CONNECT_SECRET))).status).toBe(200);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(true);
  });

  it("ignoriert unbezahlte Sessions", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    const event = await checkoutCompleted(paymentId);
    event.data.object.payment_status = "unpaid";
    await POST(signed(event, PLATFORM_SECRET));
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });

  it("weist Zahlungsereignisse aus dem Connect-Webhook zurück", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    const event = { ...(await checkoutCompleted(paymentId)), account: "acct_foreign" };
    expect((await POST(signed(event, CONNECT_SECRET))).status).toBe(400);
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });

  it("lehnt eine manipulierte Checkout-Summe ab", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    const event = await checkoutCompleted(paymentId);
    event.data.object.amount_total = 200;
    expect((await POST(signed(event, PLATFORM_SECRET))).status).toBe(500);
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });

  it("stellt eine nach Stripe-Erstellung verlorene Checkout-ID anhand des signierten Webhooks wieder her", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 200, null);
    const event = await checkoutCompleted(paymentId);
    await getDb().payments.update(paymentId, { providerPaymentId: null });
    expect((await POST(signed(event, PLATFORM_SECRET))).status).toBe(200);
    expect((await getDb().payments.get(paymentId))?.providerPaymentId).toBe(`cs_${paymentId}`);
    expect((await getDriverStats(driver.id)).balanceCents).toBe(150);
  });

  it("ignoriert Connect-Status fremder Konten trotz gültiger Signatur", async () => {
    const { driver } = await makeDriver();
    await getDb().driverProfiles.update(driver.id, { payoutAccountId: "acct_eigen" });
    const event = {
      id: "evt_wrong_account", object: "event", type: "account.updated", account: "acct_fremd",
      data: { object: { id: "acct_fremd", object: "account", payouts_enabled: true, details_submitted: true, metadata: { driverId: driver.id } } },
    };
    expect((await POST(signed(event, CONNECT_SECRET))).status).toBe(200);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(false);
  });

  it("verhindert Gutschrift, wenn eine Erstattung vor dem Erfolgsereignis eintrifft", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    const completed = await checkoutCompleted(paymentId);
    const payment = (await getDb().payments.get(paymentId))!;
    vi.spyOn(stripeClient().paymentIntents, "retrieve").mockResolvedValue({
      id: "pi_123", metadata: { paymentId, purpose: "tip", referenceId: payment.referenceId },
    } as unknown as Stripe.Response<Stripe.PaymentIntent>);
    const refunded = {
      id: "evt_refund_early", object: "event", type: "charge.refunded",
      data: { object: { id: "ch_1", object: "charge", payment_intent: "pi_123", amount: 300, amount_refunded: 300 } },
    };
    expect((await POST(signed(refunded, PLATFORM_SECRET))).status).toBe(200);
    expect((await POST(signed(completed, PLATFORM_SECRET))).status).toBe(200);
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
    expect((await getDb().payments.get(paymentId))?.status).toBe("refunded");
    vi.restoreAllMocks();
  });
});
