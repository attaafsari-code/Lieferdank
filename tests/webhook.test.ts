import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { getDb } from "@/lib/db";
import { startTip } from "@/server/services/thanks";
import { getDriverStats } from "@/server/services/stats";
import { stripeClient } from "@/server/payments/stripe";
import { refreshPayoutReadiness } from "@/server/services/payouts";
import { freshDb, makeDriver } from "./helpers";

const PLATFORM_SECRET = "whsec_test_platform";
const CONNECT_SECRET = "whsec_test_connect";

function signed(payload: object, secret = CONNECT_SECRET) {
  const body = JSON.stringify(payload);
  return new Request("http://localhost/api/webhooks/stripe", { method: "POST", body,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: body, secret }) } });
}

async function directTip(gross = 300) {
  const { driver } = await makeDriver();
  const { paymentId, tipId } = await startTip(driver.code, gross, null);
  const db = getDb();
  await db.payments.update(paymentId, { provider: "stripe", providerPaymentId: `cs_${paymentId}` });
  await db.tips.update(tipId, { destinationAccountId: "acct_driver" });
  const event = { id: `evt_${paymentId}`, object: "event", account: "acct_driver", type: "checkout.session.completed",
    data: { object: { id: `cs_${paymentId}`, object: "checkout.session", payment_status: "paid", payment_intent: `pi_${paymentId}`,
      amount_total: gross, currency: "eur", metadata: { paymentId, purpose: "tip", referenceId: tipId } } } };
  vi.spyOn(stripeClient().paymentIntents, "retrieve").mockResolvedValue({ id: `pi_${paymentId}`,
    status: "succeeded", amount: gross, currency: "eur", application_fee_amount: gross === 200 ? 50 : gross === 300 ? 60 : 100,
    metadata: { paymentId, purpose: "tip", referenceId: tipId },
  } as unknown as Stripe.Response<Stripe.PaymentIntent>);
  return { driver, paymentId, tipId, event };
}

/** Lieferant mit verbundenem Stripe-Konto und ein dazu passendes account.updated-Ereignis. */
async function connectedDriver() {
  const { driver } = await makeDriver();
  await getDb().driverProfiles.update(driver.id, { payoutAccountId: "acct_driver" });
  const account = { id: "acct_driver", type: "standard", country: "DE", charges_enabled: true, payouts_enabled: true,
    details_submitted: true, capabilities: { card_payments: "active", transfers: "active" },
    controller: { fees: { payer: "account" }, losses: { payments: "stripe" } }, metadata: { driverId: driver.id } };
  const event = { id: "evt_account", account: "acct_driver", type: "account.updated", data: { object: account } };
  return { driver, account, event };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Der Stand, den Stripe beim Abruf tatsächlich liefert – unabhängig vom Snapshot im Ereignis. */
function liveAccount(account: object) {
  return vi.spyOn(stripeClient().accounts, "retrieve").mockResolvedValue(account as unknown as Stripe.Response<Stripe.Account>);
}

beforeEach(() => {
  freshDb(); vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", PLATFORM_SECRET);
  vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", CONNECT_SECRET);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("Connect-Webhook für Direct Charges", () => {
  it.each([[200, 150], [300, 240], [500, 400]])("bucht %i Cent exakt einmal mit %i Cent Fahreranteil", async (gross, share) => {
    const { driver, event } = await directTip(gross);
    for (let i = 0; i < 3; i++) expect((await POST(signed(event))).status).toBe(200);
    expect((await POST(signed({ ...event, id: `${event.id}_same_checkout` }))).status).toBe(200);
    const stats = await getDriverStats(driver.id);
    expect(stats.driverShareBeforeStripeCents).toBe(share);
    expect(stats.total.thanks).toBe(1);
    expect(await getDb().payouts.count()).toBe(0);
  });

  it("weist fehlende, falsche und Plattform-Signaturen für Connect-Zahlungen ab", async () => {
    const { driver, event } = await directTip();
    expect((await POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: "{}" }))).status).toBe(400);
    expect((await POST(signed(event, "whsec_wrong"))).status).toBe(400);
    expect((await POST(signed(event, PLATFORM_SECRET))).status).toBe(400);
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
  });

  it("akzeptiert keine identischen Signing-Secrets für beide Webhook-Quellen", async () => {
    const { event } = await directTip();
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", PLATFORM_SECRET);
    expect((await POST(signed(event, PLATFORM_SECRET))).status).toBe(503);
  });

  it("ignoriert unbekannte Zahlungen mit Warnung statt Stripe-Retry-Schleife", async () => {
    const { event } = await directTip();
    const unknown = { ...event, data: { object: { ...event.data.object, metadata: { ...event.data.object.metadata, paymentId: crypto.randomUUID() } } } };
    expect((await POST(signed(unknown))).status).toBe(200);
    const invalid = { ...event, data: { object: { ...event.data.object, metadata: { ...event.data.object.metadata, paymentId: "not-a-uuid" } } } };
    expect((await POST(signed(invalid))).status).toBe(200);
  });

  it("ignoriert fremde Refunds ohne auffindbaren Stripe-PaymentIntent", async () => {
    const { driver } = await directTip();
    vi.spyOn(stripeClient().paymentIntents, "retrieve").mockRejectedValue(Object.assign(new Error("not found"), { code: "resource_missing" }));
    const foreignRefund = { id: "evt_foreign_refund", account: "acct_driver", type: "charge.refunded",
      data: { object: { id: "ch_foreign", payment_intent: "pi_foreign", amount: 300, amount_refunded: 300, currency: "eur" } } };
    expect((await POST(signed(foreignRefund))).status).toBe(200);
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
  });

  it("verweigert fremdes Connect-Konto selbst mit gültigem Connect-Secret", async () => {
    const { driver, event } = await directTip();
    expect((await POST(signed({ ...event, account: "acct_foreign" }))).status).toBe(500);
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
  });

  it("verweigert Betrags- und Metadaten-Widersprüche", async () => {
    const { driver, event } = await directTip();
    expect((await POST(signed({ ...event, data: { object: { ...event.data.object, amount_total: 200 } } }))).status).toBe(500);
    expect((await POST(signed({ ...event, data: { object: { ...event.data.object,
      metadata: { ...event.data.object.metadata, referenceId: crypto.randomUUID() } } } }))).status).toBe(500);
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
  });

  it("schreibt ohne korrekten echten Intent und Application Fee nichts gut", async () => {
    const { driver, paymentId, tipId, event } = await directTip();
    const retrieve = vi.spyOn(stripeClient().paymentIntents, "retrieve");
    for (const actual of [
      { status: "requires_payment_method", amount: 300, currency: "eur", application_fee_amount: 60, metadata: { paymentId, purpose: "tip", referenceId: tipId } },
      { status: "succeeded", amount: 300, currency: "eur", application_fee_amount: 0, metadata: { paymentId, purpose: "tip", referenceId: tipId } },
      { status: "succeeded", amount: 300, currency: "eur", application_fee_amount: 60, metadata: { paymentId: crypto.randomUUID(), purpose: "tip", referenceId: tipId } },
    ]) {
      retrieve.mockResolvedValue(actual as unknown as Stripe.Response<Stripe.PaymentIntent>);
      expect((await POST(signed(event))).status).toBe(500);
    }
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
    expect(retrieve).toHaveBeenCalledWith(`pi_${paymentId}`, {}, { stripeAccount: "acct_driver" });
  });

  it("setzt vollständigen Refund vor Checkout-Erfolg in Prüfung und schreibt nie erneut gut", async () => {
    const { driver, paymentId, tipId, event } = await directTip();
    vi.spyOn(stripeClient().paymentIntents, "retrieve").mockResolvedValue({ id: `pi_${paymentId}`,
      metadata: { paymentId, purpose: "tip", referenceId: tipId } } as unknown as Stripe.Response<Stripe.PaymentIntent>);
    const refund = { id: "evt_refund", account: "acct_driver", type: "charge.refunded", data: { object: {
      id: "ch_1", payment_intent: `pi_${paymentId}`, amount: 300, amount_refunded: 300, currency: "eur",
    } } };
    expect((await POST(signed(refund))).status).toBe(200);
    expect((await POST(signed(event))).status).toBe(200);
    expect((await POST(signed(refund))).status).toBe(200);
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
    expect((await getDb().payments.get(paymentId))?.refundedAmountCents).toBe(300);
    expect((await getDb().payments.get(paymentId))?.status).toBe("review_required");
  });

  it("behandelt Teilrefund kumulativ und monoton", async () => {
    const { paymentId, tipId, event } = await directTip();
    await POST(signed(event));
    vi.spyOn(stripeClient().paymentIntents, "retrieve").mockResolvedValue({ id: `pi_${paymentId}`,
      metadata: { paymentId, purpose: "tip", referenceId: tipId } } as unknown as Stripe.Response<Stripe.PaymentIntent>);
    for (const amount_refunded of [100, 200, 100, 200]) {
      const refund = { id: `evt_refund_${amount_refunded}`, account: "acct_driver", type: "charge.refunded",
        data: { object: { id: "ch_1", payment_intent: `pi_${paymentId}`, amount: 300, amount_refunded, currency: "eur" } } };
      expect((await POST(signed(refund))).status).toBe(200);
    }
    expect((await getDb().payments.get(paymentId))?.refundedAmountCents).toBe(200);
  });

  it("markiert Dispute und ignoriert fremde Disputes", async () => {
    const { paymentId, tipId, event } = await directTip();
    await POST(signed(event));
    vi.spyOn(stripeClient().paymentIntents, "retrieve").mockResolvedValue({ id: `pi_${paymentId}`,
      amount: 300, currency: "eur", metadata: { paymentId, purpose: "tip", referenceId: tipId } } as unknown as Stripe.Response<Stripe.PaymentIntent>);
    const dispute = { id: "evt_dispute", account: "acct_driver", type: "charge.dispute.created",
      data: { object: { id: "du_1", payment_intent: `pi_${paymentId}` } } };
    expect((await POST(signed(dispute))).status).toBe(200);
    expect((await getDb().payments.get(paymentId))?.status).toBe("review_required");
  });

  it("prüft Connect-Status mit Gebühren- und Verlustrisiko-Konfiguration am Live-Konto", async () => {
    const { driver, account, event } = await connectedDriver();
    liveAccount(account);
    expect((await POST(signed(event))).status).toBe(200);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(true);
    liveAccount({ ...account, controller: { fees: { payer: "application" }, losses: { payments: "application" } } });
    expect((await POST(signed(event))).status).toBe(200);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(false);
    // Ein Konto, das Stripe einem anderen Lieferanten zuordnet, ist für diesen nie bereit.
    liveAccount({ ...account, metadata: { driverId: "00000000-0000-4000-8000-000000000000" } });
    await getDb().driverProfiles.update(driver.id, { payoutReady: true });
    expect((await POST(signed(event))).status).toBe(200);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(false);
  });

  it("übernimmt aus verspätet zugestellten account.updated-Ereignissen keinen veralteten Stand", async () => {
    const { driver, account, event } = await connectedDriver();
    const outdated = { ...account, charges_enabled: false, payouts_enabled: false, details_submitted: false };
    // Stripe meldet „bereit“, danach trifft das ältere Ereignis mit dem unfertigen Snapshot ein.
    const retrieve = liveAccount(account);
    expect((await POST(signed(event))).status).toBe(200);
    expect((await POST(signed({ ...event, id: "evt_account_alt", created: 1, data: { object: outdated } }))).status).toBe(200);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(true);
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(retrieve).toHaveBeenCalledWith("acct_driver");
    // Umgekehrt: Stripe hat das Konto inzwischen eingeschränkt, ein altes Ereignis sagt noch „bereit“.
    liveAccount(outdated);
    expect((await POST(signed({ ...event, id: "evt_account_alt_2", data: { object: account } }))).status).toBe(200);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(false);
  });

  it("lässt payoutReady bei einer Stripe-Störung unverändert und fordert die erneute Zustellung an", async () => {
    const { driver, account, event } = await connectedDriver();
    await getDb().driverProfiles.update(driver.id, { payoutReady: true });
    const unfinished = { ...event, data: { object: { ...account, charges_enabled: false } } };
    const raw = { type: "api_error" as const, message: "Stripe nicht erreichbar" };
    for (const error of [new Stripe.errors.StripeConnectionError(raw), new Stripe.errors.StripeAPIError(raw),
      new Stripe.errors.StripeRateLimitError(raw), new Error("socket hang up")]) {
      vi.spyOn(stripeClient().accounts, "retrieve").mockRejectedValue(error);
      expect((await POST(signed(unfinished))).status).toBe(500);
      expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(true);
    }
    // Sobald Stripe wieder antwortet, setzt die erneute Zustellung den echten Stand.
    liveAccount(unfinished.data.object);
    expect((await POST(signed(unfinished))).status).toBe(200);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(false);
  });

  it("verändert payoutReady bei account_invalid, 403, Berechtigungsfehlern und resource_missing nicht und meldet kein gelöschtes Konto", async () => {
    const { driver, event } = await connectedDriver();
    const raw = { type: "invalid_request_error" as const, message: "The provided key does not have access to account geheim@beispiel.de" };
    // Nichts davon beweist ein fehlendes Konto: account_invalid heißt „kein Zugriff oder existiert nicht“ und
    // käme bei einem falschen Plattform-Schlüssel für jedes Konto.
    const errors = [
      new Stripe.errors.StripePermissionError({ ...raw, code: "account_invalid", statusCode: 403 }),
      new Stripe.errors.StripePermissionError({ ...raw, statusCode: 403 }),
      new Stripe.errors.StripePermissionError({ ...raw, code: "platform_api_key_expired", statusCode: 403 }),
      new Stripe.errors.StripeInvalidRequestError({ ...raw, code: "resource_missing", statusCode: 404 }),
      new Stripe.errors.StripeInvalidRequestError({ ...raw, statusCode: 400 }),
      new Stripe.errors.StripeAuthenticationError({ ...raw, statusCode: 401 }),
    ];
    for (const error of errors) {
      vi.spyOn(stripeClient().accounts, "retrieve").mockRejectedValue(error);
      for (const stored of [true, false]) {
        await getDb().driverProfiles.update(driver.id, { payoutReady: stored });
        const before = (await getDb().driverProfiles.get(driver.id))!;
        // Nicht-2xx: Stripe stellt das Ereignis später erneut zu.
        expect((await POST(signed(event))).status).toBe(500);
        // Weder der Status noch die Abgleich-Version werden angefasst.
        expect(await getDb().driverProfiles.get(driver.id)).toEqual(before);
      }
    }
    const events = await getDb().systemEvents.findMany({ where: { source: "stripe-webhook" } });
    expect(events).toHaveLength(errors.length * 2);
    expect(events.every((entry) => entry.level === "error" && /Verarbeitung fehlgeschlagen/.test(entry.message))).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/nicht mehr vorhanden|nicht bereit markiert|nicht verwendbar|gelöscht/);
    expect(JSON.stringify(events)).not.toContain("geheim@beispiel.de");
  });

  it("lässt einen Dashboard-Abgleich keinen neueren Webhook-Stand überschreiben – und umgekehrt", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    const { driver, account, event } = await connectedDriver();
    const state = (ready: boolean) => ({ ...account, charges_enabled: ready }) as unknown as Stripe.Response<Stripe.Account>;
    for (const [first, second] of [["dashboard", "webhook"], ["webhook", "dashboard"]] as const) {
      await getDb().driverProfiles.update(driver.id, { payoutReady: false });
      const stored = (await getDb().driverProfiles.get(driver.id))!;
      const older = deferred<Stripe.Response<Stripe.Account>>();
      const newer = deferred<Stripe.Response<Stripe.Account>>();
      const retrieve = vi.spyOn(stripeClient().accounts, "retrieve").mockReset()
        .mockImplementationOnce(() => older.promise as never)
        .mockImplementationOnce(() => newer.promise as never)
        .mockResolvedValue(state(true));
      const start = (kind: "dashboard" | "webhook"): Promise<unknown> => kind === "dashboard"
        ? refreshPayoutReadiness(stored)
        : POST(signed({ ...event, id: `evt_${first}_${second}` })).then((response) => expect(response.status).toBe(200));
      // Der zuerst gestartete Abgleich fragt Stripe zuerst – und bekommt seine (ältere) Antwort zuletzt.
      const slow = start(first);
      await vi.waitFor(() => expect(retrieve).toHaveBeenCalledTimes(1));
      const fast = start(second);
      await vi.waitFor(() => expect(retrieve).toHaveBeenCalledTimes(2));
      newer.resolve(state(true));
      await fast;
      expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(true);
      older.resolve(state(false));
      await slow;
      expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(true);
      expect(retrieve).toHaveBeenCalledTimes(3);
    }
  });

  it.each([
    ["Stripe hat das Konto inzwischen eingeschränkt", true, false],
    ["Stripe hat das Konto inzwischen freigeschaltet", false, true],
  ])("lässt einen parallelen, älteren Abruf keinen neueren Stand überschreiben – %s", async (_label, olderReady, newerReady) => {
    const { driver, account, event } = await connectedDriver();
    await getDb().driverProfiles.update(driver.id, { payoutReady: olderReady });
    const state = (ready: boolean) => ({ ...account, charges_enabled: ready }) as unknown as Stripe.Response<Stripe.Account>;
    const older = deferred<Stripe.Response<Stripe.Account>>();
    const newer = deferred<Stripe.Response<Stripe.Account>>();
    // Zwei Webhooks laufen gleichzeitig: der erste Abruf sieht noch den alten Stand, der zweite schon den neuen.
    const retrieve = vi.spyOn(stripeClient().accounts, "retrieve")
      .mockImplementationOnce(() => older.promise as never)
      .mockImplementationOnce(() => newer.promise as never)
      .mockResolvedValue(state(newerReady));
    const both = Promise.all([POST(signed({ ...event, id: "evt_parallel_1" })), POST(signed({ ...event, id: "evt_parallel_2" }))]);
    await vi.waitFor(() => expect(retrieve).toHaveBeenCalledTimes(2));

    // Der neuere Abruf antwortet und schreibt zuerst …
    newer.resolve(state(newerReady));
    await vi.waitFor(async () => expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(newerReady));
    // … der ältere antwortet danach. Er darf nicht mehr schreiben, sondern muss neu lesen.
    older.resolve(state(olderReady));
    expect((await both).map((response) => response.status)).toEqual([200, 200]);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(newerReady);
    expect(retrieve).toHaveBeenCalledTimes(3);
  });

  it("fragt Stripe für fremde oder unbekannte Konten gar nicht erst ab", async () => {
    const { driver, account, event } = await connectedDriver();
    const retrieve = liveAccount(account);
    await getDb().driverProfiles.update(driver.id, { payoutAccountId: "acct_anderes" });
    expect((await POST(signed(event))).status).toBe(200);
    expect(retrieve).not.toHaveBeenCalled();
    expect((await getDb().driverProfiles.get(driver.id))?.payoutReady).toBe(false);
  });

  it("begrenzt Payload und akzeptiert keine veränderte Signatur", async () => {
    const { event } = await directTip();
    const request = signed(event);
    const tampered = new Request(request.url, { method: "POST", headers: request.headers, body: "{}" });
    expect((await POST(tampered)).status).toBe(400);
    expect((await POST(signed({ ...event, padding: "x".repeat(270_000) }))).status).toBe(413);
  });
});
