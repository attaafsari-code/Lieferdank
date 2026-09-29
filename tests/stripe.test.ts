import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stripeAccountCompatible, stripeAccountReady, stripeClient, stripePaymentProvider } from "@/server/payments/stripe";
import { getDb } from "@/lib/db";
import { confirmPayment, startTip } from "@/server/services/thanks";
import { freshDb, makeDriver } from "./helpers";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const input = {
  paymentId: "payment-1", purpose: "tip" as const, referenceId: "tip-1",
  amountCents: 300, applicationFeeCents: 60, destinationAccountId: "acct_driver",
  driverId: "driver-1",
  description: "Danke an Max", returnUrl: "https://lieferdank.de/danke/LD-ABCDE/erfolg",
  cancelUrl: "https://lieferdank.de/danke/LD-ABCDE",
};

describe("Stripe Direct Charges", () => {
  it.each([[200, 50], [300, 60], [500, 100]])("berechnet %i Cent als Direct Charge mit %i Cent Application Fee", async (gross, fee) => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    vi.spyOn(stripePaymentProvider, "isAccountReady").mockResolvedValue(true);
    const create = vi.spyOn(stripeClient().checkout.sessions, "create").mockResolvedValue({
      id: "cs_test_1", url: "https://checkout.stripe.com/test",
    } as Stripe.Response<Stripe.Checkout.Session>);
    await stripePaymentProvider.createPayment({ ...input, amountCents: gross, applicationFeeCents: fee });
    const [session, options] = create.mock.calls[0] as unknown as [Stripe.Checkout.SessionCreateParams, Stripe.RequestOptions];
    expect(session.line_items?.[0]?.price_data?.unit_amount).toBe(gross);
    expect(session.line_items?.[0]?.price_data?.currency).toBe("eur");
    expect(session.payment_intent_data?.application_fee_amount).toBe(fee);
    expect(session.payment_intent_data).not.toHaveProperty("transfer_data");
    expect(options.stripeAccount).toBe("acct_driver");
    expect(options.idempotencyKey).toBe("checkout_payment-1");
    expect(session.payment_method_types).toEqual(["card"]);
    expect(stripePaymentProvider.isAccountReady).toHaveBeenCalledWith("acct_driver", "driver-1");
  });

  it("lehnt manipulierte Beträge, Gebühren und fehlendes Connect-Konto vor Stripe ab", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    vi.spyOn(stripePaymentProvider, "isAccountReady").mockResolvedValue(true);
    const create = vi.spyOn(stripeClient().checkout.sessions, "create");
    for (const amount of [0, 1, 199, 201, 400, 600, -200, 999999999, 2.5, NaN, "200", null, [], {}]) {
      await expect(stripePaymentProvider.createPayment({ ...input, amountCents: amount as number })).rejects.toThrow();
    }
    await expect(stripePaymentProvider.createPayment({ ...input, applicationFeeCents: 50 })).rejects.toThrow();
    await expect(stripePaymentProvider.createPayment({ ...input, destinationAccountId: null })).rejects.toThrow();
    await expect(stripePaymentProvider.createPayment({ ...input, driverId: undefined })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("verweigert ein unbereites Konto und startet keinen Plattform-Hold", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    vi.spyOn(stripePaymentProvider, "isAccountReady").mockResolvedValue(false);
    const create = vi.spyOn(stripeClient().checkout.sessions, "create");
    await expect(stripePaymentProvider.createPayment(input)).rejects.toThrow(/einsatzbereites/);
    expect(create).not.toHaveBeenCalled();
  });

  it("blockiert Live-Stripe in Preview vor dem Erzeugen einer Session", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_dummy");
    const create = vi.spyOn(stripeClient().checkout.sessions, "create");
    await expect(stripePaymentProvider.createPayment(input)).rejects.toThrow(/Deployment-Umgebung/);
    expect(create).not.toHaveBeenCalled();
  });

  it("erstellt ausschließlich Standard-Konten für DE und fordert beide Fähigkeiten an", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const create = vi.spyOn(stripeClient().accounts, "create").mockResolvedValue({ id: "acct_new", type: "standard" } as Stripe.Response<Stripe.Account>);
    expect(await stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id" })).toBe("acct_new");
    expect(create.mock.calls[0][0]).toMatchObject({ type: "standard", country: "DE", capabilities: {
      card_payments: { requested: true }, transfers: { requested: true },
    } });
  });

  it.each(["express", "custom"] as const)("verwirft ein als %s zurückgegebenes neues Stripe-Konto", async (type) => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    vi.spyOn(stripeClient().accounts, "create").mockResolvedValue({ id: "acct_wrong", type } as Stripe.Response<Stripe.Account>);
    await expect(stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id" }))
      .rejects.toThrow(/Standard-Konto/);
  });

  it("akzeptiert nur Stripe-fee-payer und Stripe-loss-liability mit aktiver Kartenfunktion", () => {
    const ready = { type: "standard", country: "DE", charges_enabled: true, payouts_enabled: true, details_submitted: true,
      capabilities: { card_payments: "active", transfers: "active" }, metadata: { driverId: "driver-1" },
      controller: { fees: { payer: "account" }, losses: { payments: "stripe" } } } as unknown as Stripe.Account;
    expect(stripeAccountReady(ready)).toBe(true);
    expect(stripeAccountCompatible(ready, "driver-1")).toBe(true);
    expect(stripeAccountCompatible(ready, "other-driver")).toBe(false);
    for (const type of ["express", "custom"] as const) {
      const wrongType = { ...ready, type } as Stripe.Account;
      expect(stripeAccountCompatible(wrongType, "driver-1")).toBe(false);
      expect(stripeAccountReady(wrongType)).toBe(false);
    }
    expect(stripeAccountReady({ ...ready, controller: { ...ready.controller!, fees: { payer: "application_express" } } } as Stripe.Account)).toBe(false);
    expect(stripeAccountReady({ ...ready, controller: { ...ready.controller!, fees: { payer: "application" } } } as Stripe.Account)).toBe(false);
    expect(stripeAccountReady({ ...ready, controller: { ...ready.controller!, losses: { payments: "application" } } } as Stripe.Account)).toBe(false);
    expect(stripeAccountReady({ ...ready, charges_enabled: false })).toBe(false);
    expect(stripeAccountReady({ ...ready, capabilities: { card_payments: "pending" } })).toBe(false);
    expect(stripeAccountReady({ ...ready, capabilities: { ...ready.capabilities, transfers: "pending" } })).toBe(false);
  });

  it("verweigert Checkout und Onboarding für ein fremdes oder altes Express-Konto", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const ready = { type: "standard", country: "DE", charges_enabled: true, payouts_enabled: true, details_submitted: true,
      capabilities: { card_payments: "active", transfers: "active" }, metadata: { driverId: "other-driver" },
      controller: { fees: { payer: "account" }, losses: { payments: "stripe" } } } as unknown as Stripe.Response<Stripe.Account>;
    vi.spyOn(stripeClient().accounts, "retrieve").mockResolvedValue(ready);
    const checkout = vi.spyOn(stripeClient().checkout.sessions, "create");
    const links = vi.spyOn(stripeClient().accountLinks, "create");
    await expect(stripePaymentProvider.createPayment(input)).rejects.toThrow(/Stripe-Konto/);
    await expect(stripePaymentProvider.onboardDriver({ accountId: "acct_driver", driverId: "driver-1", returnUrl: "https://lieferdank.de", refreshUrl: "https://lieferdank.de" })).rejects.toThrow(/nicht verwendet/);
    expect(checkout).not.toHaveBeenCalled();
    expect(links).not.toHaveBeenCalled();
    vi.spyOn(stripeClient().accounts, "retrieve").mockResolvedValue({ ...ready, metadata: { driverId: "driver-1" }, controller: {
      ...ready.controller!, fees: { payer: "application_express" },
    } } as Stripe.Response<Stripe.Account>);
    await expect(stripePaymentProvider.createPayment(input)).rejects.toThrow(/Stripe-Konto/);
    await expect(stripePaymentProvider.onboardDriver({ accountId: "acct_driver", driverId: "driver-1", returnUrl: "https://lieferdank.de", refreshUrl: "https://lieferdank.de" })).rejects.toThrow(/nicht verwendet/);
    expect(checkout).not.toHaveBeenCalled();
    expect(links).not.toHaveBeenCalled();
  });

  it("öffnet Hosted Onboarding nur für das kompatible eigene Standard-Konto", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    vi.spyOn(stripeClient().accounts, "retrieve").mockResolvedValue({ id: "acct_driver", type: "standard", country: "DE",
      metadata: { driverId: "driver-1" }, controller: { fees: { payer: "account" }, losses: { payments: "stripe" } },
    } as unknown as Stripe.Response<Stripe.Account>);
    const create = vi.spyOn(stripeClient().accountLinks, "create").mockResolvedValue({ url: "https://connect.stripe.com/setup" } as Stripe.Response<Stripe.AccountLink>);
    expect(await stripePaymentProvider.onboardDriver({ accountId: "acct_driver", driverId: "driver-1",
      returnUrl: "https://lieferdank.de/dashboard/einnahmen?konto=fertig",
      refreshUrl: "https://lieferdank.de/dashboard/einnahmen?konto=neu",
    })).toEqual({ accountId: "acct_driver", url: "https://connect.stripe.com/setup" });
    expect(create.mock.calls[0][0]).toMatchObject({ account: "acct_driver", type: "account_onboarding" });
  });

  it.each(["express", "custom"] as const)("verweigert Checkout und Hosted Onboarding für gespeicherte %s-Konten", async (type) => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    vi.spyOn(stripeClient().accounts, "retrieve").mockResolvedValue({
      id: "acct_driver", type, country: "DE", charges_enabled: true, payouts_enabled: true,
      details_submitted: true, capabilities: { card_payments: "active", transfers: "active" },
      metadata: { driverId: "driver-1" },
      controller: { fees: { payer: "account" }, losses: { payments: "stripe" } },
    } as unknown as Stripe.Response<Stripe.Account>);
    const checkout = vi.spyOn(stripeClient().checkout.sessions, "create");
    const links = vi.spyOn(stripeClient().accountLinks, "create");
    await expect(stripePaymentProvider.createPayment(input)).rejects.toThrow(/Stripe-Konto/);
    await expect(stripePaymentProvider.onboardDriver({ accountId: "acct_driver", driverId: "driver-1",
      returnUrl: "https://lieferdank.de", refreshUrl: "https://lieferdank.de",
    })).rejects.toThrow(/nicht verwendet/);
    expect(checkout).not.toHaveBeenCalled();
    expect(links).not.toHaveBeenCalled();
  });

  it("erstattet Direct Charges auf dem Connected Account einschließlich Application Fee", async () => {
    freshDb(); vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const { driver } = await makeDriver();
    const { paymentId, tipId } = await startTip(driver.code, 300, null);
    await getDb().payments.update(paymentId, { provider: "stripe" });
    await getDb().tips.update(tipId, { destinationAccountId: "acct_driver" });
    await confirmPayment(paymentId, { providerIntentId: "pi_direct" });
    const refund = vi.spyOn(stripeClient().refunds, "create").mockResolvedValue({ id: "re_1" } as Stripe.Response<Stripe.Refund>);
    await stripePaymentProvider.refundPayment("pi_direct");
    expect(refund).toHaveBeenCalledWith(
      { payment_intent: "pi_direct", refund_application_fee: true },
      { idempotencyKey: `full_refund_${paymentId}`, stripeAccount: "acct_driver" },
    );
  });
});
