import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stripeClient, stripePaymentProvider } from "@/server/payments/stripe";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const input = {
  paymentId: "payment-1",
  purpose: "tip" as const,
  referenceId: "tip-1",
  amountCents: 300,
  applicationFeeCents: 50,
  destinationAccountId: "acct_driver",
  description: "Danke an Max",
  returnUrl: "https://lieferdank.de/danke/LD-ABCDE/erfolg",
  cancelUrl: "https://lieferdank.de/danke/LD-ABCDE",
};

describe("Stripe Checkout-Konfiguration", () => {
  it("berechnet exakt 3 € mit 50 Cent Connect-Gebühr und serverseitigen Metadaten", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const create = vi.spyOn(stripeClient().checkout.sessions, "create").mockResolvedValue({
      id: "cs_test_1", url: "https://checkout.stripe.com/test",
    } as Stripe.Response<Stripe.Checkout.Session>);
    const result = await stripePaymentProvider.createPayment(input);
    expect(result.providerPaymentId).toBe("cs_test_1");
    const [session, options] = create.mock.calls[0] as unknown as [Stripe.Checkout.SessionCreateParams, Stripe.RequestOptions];
    expect(session.line_items?.[0]?.price_data?.unit_amount).toBe(300);
    expect(session.line_items?.[0]?.price_data?.currency).toBe("eur");
    expect(session.payment_intent_data?.application_fee_amount).toBe(50);
    expect(session.payment_intent_data?.transfer_data?.destination).toBe("acct_driver");
    expect(session.metadata).toMatchObject({ paymentId: "payment-1", purpose: "tip", referenceId: "tip-1" });
    expect(session).not.toHaveProperty("payment_method_types");
    expect(options?.idempotencyKey).toBe("checkout_payment-1");
  });

  it("behält bei noch nicht eingerichteten Konten den Anteil bis zur Sammelüberweisung", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const create = vi.spyOn(stripeClient().checkout.sessions, "create").mockResolvedValue({
      id: "cs_test_2", url: "https://checkout.stripe.com/test",
    } as Stripe.Response<Stripe.Checkout.Session>);
    await stripePaymentProvider.createPayment({ ...input, destinationAccountId: null });
    const [session] = create.mock.calls[0] as unknown as [Stripe.Checkout.SessionCreateParams];
    expect(session.payment_intent_data).not.toHaveProperty("application_fee_amount");
    expect(session.payment_intent_data).not.toHaveProperty("transfer_data");
  });

  it("erkennt eingeschränkte Live-Schlüssel als Live-Modus", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_dummy");
    expect(stripePaymentProvider.isSandbox).toBe(false);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    expect(stripePaymentProvider.isSandbox).toBe(true);
  });
});
