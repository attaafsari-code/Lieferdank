import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { getDb } from "@/lib/db";
import { startTip } from "@/server/services/thanks";
import { getDriverStats } from "@/server/services/stats";
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

function checkoutCompleted(paymentId: string) {
  return {
    id: `evt_${paymentId}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test", object: "checkout.session", payment_status: "paid", payment_intent: "pi_123", payment_method_types: ["card"], metadata: { paymentId } } },
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

    expect((await POST(signed(checkoutCompleted(paymentId), PLATFORM_SECRET))).status).toBe(200);
    expect((await POST(signed(checkoutCompleted(paymentId), PLATFORM_SECRET))).status).toBe(200);

    const stats = await getDriverStats(driver.id);
    expect(stats.balanceCents).toBe(250);
    expect(stats.total.thanks).toBe(1);
    expect((await getDb().payments.get(paymentId))?.providerIntentId).toBe("pi_123");
  });

  it("weist gefälschte Signaturen ab", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    const response = await POST(signed(checkoutCompleted(paymentId), "whsec_falsch"));
    expect(response.status).toBe(400);
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });

  it("akzeptiert Connect-Ereignisse mit dem zweiten Secret", async () => {
    const { driver } = await makeDriver();
    const event = {
      id: "evt_acct",
      object: "event",
      type: "account.updated",
      data: { object: { id: "acct_1", object: "account", payouts_enabled: true, details_submitted: true, metadata: { driverId: driver.id } } },
    };
    expect((await POST(signed(event, CONNECT_SECRET))).status).toBe(200);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(true);
  });

  it("ignoriert unbezahlte Sessions", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    const event = checkoutCompleted(paymentId);
    event.data.object.payment_status = "unpaid";
    await POST(signed(event, PLATFORM_SECRET));
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });
});
