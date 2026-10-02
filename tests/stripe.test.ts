import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DRIVER_PAYOUT_INTERVAL, DRIVER_PRODUCT_DESCRIPTION, DRIVER_STATEMENT_DESCRIPTOR, stripeAccountAccessDenied, stripeAccountCompatible, stripeAccountReady, stripeClient, stripePaymentProvider } from "@/server/payments/stripe";
import { isProductionRuntime } from "@/lib/runtime";
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

  it("führt in Preview und Entwicklung mit Live-Schlüssel keinen schreibenden Stripe-Aufruf aus", async () => {
    freshDb();
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_dummy");
    const accounts = vi.spyOn(stripeClient().accounts, "create");
    const retrieve = vi.spyOn(stripeClient().accounts, "retrieve");
    const links = vi.spyOn(stripeClient().accountLinks, "create");
    const refunds = vi.spyOn(stripeClient().refunds, "create");
    // Preview auf Vercel, lokale Entwicklung und Vercel-„development“: Live-Schlüssel sind überall tabu –
    // auch wenn in der Vercel-Entwicklungsumgebung mit NODE_ENV=production gebaut wurde.
    for (const [nodeEnv, vercelEnv] of [["production", "preview"], ["development", ""], ["test", ""], ["development", "development"],
      ["production", "development"]]) {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      await expect(stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id",
        profileUrl: "https://lieferdank.de/danke/LD-ABCDE" })).rejects.toThrow(/Deployment-Umgebung/);
      await expect(stripePaymentProvider.onboardDriver({ accountId: "acct_driver", driverId: "driver-id",
        returnUrl: "https://lieferdank.de", refreshUrl: "https://lieferdank.de" })).rejects.toThrow(/Deployment-Umgebung/);
      await expect(stripePaymentProvider.refundPayment("pi_live")).rejects.toThrow(/Deployment-Umgebung/);
    }
    expect(accounts).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
    expect(links).not.toHaveBeenCalled();
    expect(refunds).not.toHaveBeenCalled();
  });

  it("legt Konten in Produktion nur mit Live-Schlüssel an und in der Entwicklung mit Testschlüssel", async () => {
    const created = { id: "acct_new", type: "standard" } as Stripe.Response<Stripe.Account>;
    // Produktion mit Testschlüssel: würde Testkonten in echte Profile schreiben.
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const blocked = vi.spyOn(stripeClient().accounts, "create").mockResolvedValue(created);
    await expect(stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id" }))
      .rejects.toThrow(/Deployment-Umgebung/);
    expect(blocked).not.toHaveBeenCalled();
    // Produktion mit Live-Schlüssel und Entwicklung mit Testschlüssel funktionieren.
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_dummy");
    expect(await stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id" })).toBe("acct_new");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    expect(await stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id" })).toBe("acct_new");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id" })).toBe("acct_new");
    expect(blocked).toHaveBeenCalledTimes(3);
  });

  it("erstellt ausschließlich Standard-Konten für DE und fordert beide Fähigkeiten an", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const create = vi.spyOn(stripeClient().accounts, "create").mockResolvedValue({ id: "acct_new", type: "standard" } as Stripe.Response<Stripe.Account>);
    expect(await stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id" })).toBe("acct_new");
    expect(create.mock.calls[0][0]).toMatchObject({ type: "standard", country: "DE", capabilities: {
      card_payments: { requested: true }, transfers: { requested: true },
    } });
  });

  it("belegt für Privatpersonen nur wahre Profilangaben vor – Profilseite und Beschreibung, keine Branche", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const create = vi.spyOn(stripeClient().accounts, "create").mockResolvedValue({ id: "acct_new", type: "standard" } as Stripe.Response<Stripe.Account>);
    await stripePaymentProvider.createConnectedAccount({
      email: "max@test.de", driverId: "driver-id", profileUrl: "https://lieferdank.de/danke/LD-ABCDE",
    });
    const [params, options] = create.mock.calls[0] as unknown as [Stripe.AccountCreateParams, Stripe.RequestOptions];
    expect(params.business_type).toBe("individual");
    expect(params.business_profile).toEqual({
      url: "https://lieferdank.de/danke/LD-ABCDE",
      product_description: DRIVER_PRODUCT_DESCRIPTION,
    });
    // Branche und öffentliche Support-Telefonnummer entscheidet der Lieferant selbst bei Stripe.
    expect(params.business_profile).not.toHaveProperty("mcc");
    expect(params.business_profile).not.toHaveProperty("support_phone");
    expect(options.idempotencyKey).toBe("driver_account_standard_v3_driver-id");
  });

  it("sendet für neue Konten den Kontoauszugstext und einen automatischen Auszahlungsplan", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const create = vi.spyOn(stripeClient().accounts, "create").mockResolvedValue({ id: "acct_new", type: "standard" } as Stripe.Response<Stripe.Account>);
    await stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id" });
    const [params] = create.mock.calls[0] as unknown as [Stripe.AccountCreateParams];
    expect(params.settings).toEqual({
      payments: { statement_descriptor: "LIEFERDANK TRINKGELD" },
      payouts: { schedule: { interval: "daily" } },
    });
    // Nie „manuell“ vorbelegen – sonst kommt das Trinkgeld nicht von selbst an.
    expect(DRIVER_PAYOUT_INTERVAL).not.toBe("manual");
    // Kurzpräfix leitet Stripe selbst ab; ein eigener Wert könnte davon abweichen.
    expect(params.settings).not.toHaveProperty("card_payments");
  });

  it("hält Stripes Regeln für den Kontoauszugstext ein", () => {
    expect(DRIVER_STATEMENT_DESCRIPTOR).toBe("LIEFERDANK TRINKGELD");
    expect(DRIVER_STATEMENT_DESCRIPTOR.length).toBeGreaterThanOrEqual(5);
    expect(DRIVER_STATEMENT_DESCRIPTOR.length).toBeLessThanOrEqual(22);
    expect(DRIVER_STATEMENT_DESCRIPTOR).toMatch(/^[A-Za-z0-9 .,&-]+$/);
    expect(DRIVER_STATEMENT_DESCRIPTOR).toMatch(/[A-Za-z]/);
    expect(DRIVER_STATEMENT_DESCRIPTOR).not.toMatch(/[<>\\'"*]/);
    expect(DRIVER_STATEMENT_DESCRIPTOR.trim().split(/\s+/).length).toBeGreaterThan(1);
  });

  it.each([["manual", "manual"], ["daily", "automatic"], ["weekly", "automatic"], ["monthly", "automatic"]] as const)(
    "meldet den Stripe-Auszahlungsplan %s als %s",
    async (interval, expected) => {
      vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
      const retrieve = vi.spyOn(stripeClient().accounts, "retrieve").mockResolvedValue(
        { id: "acct_driver", settings: { payouts: { schedule: { interval } } } } as unknown as Stripe.Response<Stripe.Account>,
      );
      expect(await stripePaymentProvider.payoutInterval("acct_driver")).toBe(expected);
      // Reiner Oberflächenhinweis: kurz warten, nicht wiederholen.
      expect((retrieve.mock.calls[0] as unknown as unknown[])[2]).toMatchObject({ timeout: 4000, maxNetworkRetries: 0 });
    },
  );

  it.each([
    "https://lieferdank.de/danke/LD-ABCDE",
    "https://lieferdank-git-test.vercel.app/danke/LD-ABCDE",
  ])("übergibt die öffentliche https-Adresse %s als Website", async (profileUrl) => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    const create = vi.spyOn(stripeClient().accounts, "create").mockResolvedValue({ id: "acct_new", type: "standard" } as Stripe.Response<Stripe.Account>);
    await stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id", profileUrl });
    const [params] = create.mock.calls[0] as unknown as [Stripe.AccountCreateParams];
    expect(params.business_profile?.url).toBe(profileUrl);
  });

  it.each([
    // Öffentlich, aber unverschlüsselt.
    "http://lieferdank.de/danke/LD-ABCDE",
    // Lokal, privat oder LAN – auch mit https.
    "http://192.168.1.20:3000/danke/LD-ABCDE",
    "https://192.168.1.20/danke/LD-ABCDE",
    "https://10.0.0.5/danke/LD-ABCDE",
    "http://localhost:3000/danke/LD-ABCDE",
    "https://localhost/danke/LD-ABCDE",
    "https://127.0.0.1/danke/LD-ABCDE",
    "kein-link",
    null,
  ])(
    "übergibt %s nicht als Website, nur die Beschreibung",
    async (profileUrl) => {
      vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
      const create = vi.spyOn(stripeClient().accounts, "create").mockResolvedValue({ id: "acct_new", type: "standard" } as Stripe.Response<Stripe.Account>);
      await stripePaymentProvider.createConnectedAccount({ email: "max@test.de", driverId: "driver-id", profileUrl });
      const [params] = create.mock.calls[0] as unknown as [Stripe.AccountCreateParams];
      expect(params.business_profile).toEqual({ product_description: DRIVER_PRODUCT_DESCRIPTION });
    },
  );

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

  it("protokolliert ein nicht verwendbares Konto und stört die Störungsbehandlung nicht", async () => {
    freshDb(); vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    vi.spyOn(stripeClient().accounts, "retrieve").mockResolvedValue({ id: "acct_driver", type: "express", country: "DE",
      metadata: { driverId: "driver-1" }, controller: { fees: { payer: "account" }, losses: { payments: "stripe" } },
    } as unknown as Stripe.Response<Stripe.Account>);
    await expect(stripePaymentProvider.onboardDriver({ accountId: "acct_driver", driverId: "driver-1",
      returnUrl: "https://lieferdank.de", refreshUrl: "https://lieferdank.de",
    })).rejects.toThrow(/Lieferdank-Support/);
    const [event] = await getDb().systemEvents.findMany({ where: { source: "stripe-connect" } });
    expect(event.context).toMatchObject({ driverId: "driver-1", accountId: "acct_driver", accountType: "express", country: "DE" });

    // Eine vorübergehende Stripe-Störung ist kein Kontoproblem und erzeugt kein solches Ereignis.
    freshDb();
    vi.spyOn(stripeClient().accounts, "retrieve").mockRejectedValue(new Error("network"));
    await expect(stripePaymentProvider.onboardDriver({ accountId: "acct_driver", driverId: "driver-1",
      returnUrl: "https://lieferdank.de", refreshUrl: "https://lieferdank.de",
    })).rejects.toThrow("network");
    expect(await getDb().systemEvents.count({ where: { source: "stripe-connect" } })).toBe(0);
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

  it("wertet nur VERCEL_ENV=production oder einen Produktionsstart ohne Vercel als Produktion", () => {
    const runtime = (nodeEnv: string, vercelEnv: string) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      return isProductionRuntime();
    };
    expect(runtime("production", "production")).toBe(true);
    expect(runtime("production", "")).toBe(true);
    // Ist VERCEL_ENV gesetzt, deutet NODE_ENV es nicht in „Produktion“ um.
    expect(runtime("production", "development")).toBe(false);
    expect(runtime("production", "preview")).toBe(false);
    expect(runtime("development", "development")).toBe(false);
    expect(runtime("development", "")).toBe(false);
    expect(runtime("test", "")).toBe(false);
  });

  it("leitet aus keinem Stripe-Fehler ein gelöschtes Konto ab – account_invalid heißt nur „Zugriff verweigert“", () => {
    const raw = { type: "invalid_request_error" as const, message: "x" };
    // Im Stripe-Testmodus belegt: accounts.retrieve auf ein unerreichbares Konto liefert 403 + account_invalid,
    // mit der Meldung „does not have access to account … (or that account does not exist)“.
    expect(stripeAccountAccessDenied(new Stripe.errors.StripePermissionError({ ...raw, code: "account_invalid", statusCode: 403 }))).toBe(true);
    // Für diesen Abruf nicht belegt bzw. mehrdeutig: gewöhnliche Störung.
    expect(stripeAccountAccessDenied(new Stripe.errors.StripeInvalidRequestError({ ...raw, code: "resource_missing", statusCode: 404 }))).toBe(false);
    expect(stripeAccountAccessDenied(new Stripe.errors.StripePermissionError({ ...raw, statusCode: 403 }))).toBe(false);
    expect(stripeAccountAccessDenied(new Stripe.errors.StripePermissionError({ ...raw, code: "platform_api_key_expired", statusCode: 403 }))).toBe(false);
    expect(stripeAccountAccessDenied(new Stripe.errors.StripeInvalidRequestError({ ...raw, statusCode: 400 }))).toBe(false);
    expect(stripeAccountAccessDenied(new Stripe.errors.StripeAuthenticationError({ ...raw, statusCode: 401 }))).toBe(false);
    expect(stripeAccountAccessDenied(new Error("account_invalid"))).toBe(false);
  });

  it("behandelt 403, Berechtigungsfehler und resource_missing beim Onboarding als Störung, nicht als gelöschtes Konto", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    freshDb();
    const links = vi.spyOn(stripeClient().accountLinks, "create");
    const raw = { type: "invalid_request_error" as const, message: "The provided key does not have the required permissions" };
    for (const error of [new Stripe.errors.StripePermissionError({ ...raw, statusCode: 403 }),
      new Stripe.errors.StripePermissionError({ ...raw, code: "platform_api_key_expired", statusCode: 403 }),
      new Stripe.errors.StripeInvalidRequestError({ ...raw, code: "resource_missing", statusCode: 404 }),
      new Stripe.errors.StripeInvalidRequestError({ ...raw, statusCode: 400 }),
      new Stripe.errors.StripeAuthenticationError({ ...raw, statusCode: 401 }),
      new Error("network")]) {
      vi.spyOn(stripeClient().accounts, "retrieve").mockRejectedValue(error);
      const attempt = stripePaymentProvider.onboardDriver({ accountId: "acct_driver", driverId: "driver-1",
        returnUrl: "https://lieferdank.de", refreshUrl: "https://lieferdank.de" });
      // Der ursprüngliche Fehler bleibt: kein „Konto nicht verwendbar“, kein Support-Hinweis.
      await expect(attempt).rejects.toBe(error);
      await expect(attempt).rejects.not.toThrow(/Lieferdank-Support|nicht verwendet werden/);
    }
    expect(await getDb().systemEvents.count({ where: { source: "stripe-connect" } })).toBe(0);
    expect(links).not.toHaveBeenCalled();
  });

  it("meldet bei account_invalid neutral „Zugriff verweigert“ – ohne Löschung oder dauerhafte Untauglichkeit zu behaupten", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_dummy");
    freshDb();
    const links = vi.spyOn(stripeClient().accountLinks, "create");
    const raw = { type: "invalid_request_error" as const, message: "The provided key does not have access to account geheim@beispiel.de" };
    vi.spyOn(stripeClient().accounts, "retrieve").mockRejectedValue(
      new Stripe.errors.StripePermissionError({ ...raw, code: "account_invalid", statusCode: 403 }));
    const attempt = stripePaymentProvider.onboardDriver({ accountId: "acct_gone", driverId: "driver-1",
      returnUrl: "https://lieferdank.de", refreshUrl: "https://lieferdank.de" });
    // Der Lieferant bekommt einen Ausweg, aber keine Behauptung über sein Konto.
    await expect(attempt).rejects.toThrow(/später erneut.*Lieferdank-Support/);
    await expect(attempt).rejects.not.toThrow(/gelöscht|nicht verwendet werden|existiert nicht|dauerhaft/);
    // Der Betrieb sieht den Fall – mit Kennungen, neutral formuliert, ohne Meldungstext oder Personendaten.
    const events = await getDb().systemEvents.findMany({ where: { source: "stripe-connect" } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ level: "error", context: { driverId: "driver-1", accountId: "acct_gone" } });
    expect(events[0].message).toMatch(/Ursache offen/);
    expect(events[0].message).not.toMatch(/gelöscht|nicht verwendbar|nicht vorhanden|nicht mehr/);
    expect(JSON.stringify(events)).not.toContain("geheim@beispiel.de");
    expect(JSON.stringify(events)).not.toContain("does not have access");
    expect(links).not.toHaveBeenCalled();
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
