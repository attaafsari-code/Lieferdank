import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { demoPaymentProvider } from "@/server/payments/demo";
import { authenticate, completePasswordReset, registerDriver, requestPasswordReset } from "@/server/services/auth";
import { confirmPayment, markRefunded, sendFreeThankYou, startTip, attachMessage } from "@/server/services/thanks";
import { getDriverStats } from "@/server/services/stats";
import { payoutDriver, refreshPayoutReadiness, startPayoutOnboarding } from "@/server/services/payouts";
import { addFavoriteByCode, listFavorites, removeFavorite, renameFavorite } from "@/server/services/favorites";
import { setDriverActive } from "@/server/services/profile";
import { toPublicDriver } from "@/server/services/drivers";
import { cardDesignSchema, createCardOrder, updateCardOrderStatus } from "@/server/services/cards";
import { parseInput } from "@/server/services/auth";
import { freshDb, makeCustomer, makeDriver } from "./helpers";

beforeEach(() => {
  freshDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("Registrierung", () => {
  it("vergibt sofort einen funktionierenden Code – ohne Verifizierung", async () => {
    const { driver } = await makeDriver();
    expect(driver.code).toMatch(/^LD-[A-Z0-9]{5}$/);
    expect(driver.verification).toBe("unverified");
    expect(driver.active).toBe(true);
    expect(await getDb().cardDesigns.findOne({ driverId: driver.id })).not.toBeNull();

    const result = await sendFreeThankYou(driver.code, null);
    expect(result.thankYouId).toBeTruthy();
  });

  it("vergibt eindeutige Codes", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 15; i++) codes.add((await makeDriver()).driver.code);
    expect(codes.size).toBe(15);
  });

  it("lehnt doppelte E-Mail-Adressen ab", async () => {
    await makeDriver();
    const db = getDb();
    const existing = (await db.users.findMany())[0];
    await expect(
      import("@/server/services/auth").then((m) =>
        m.registerDriver({ firstName: "A", lastName: "B", email: existing.email, phone: "", password: "sicheres-passwort", terms: "on" }),
      ),
    ).rejects.toThrow(/bereits ein Konto/);
  });

  it("hinterlässt bei einem fehlgeschlagenen Profil keinen unbenutzbaren Account", async () => {
    const db = getDb();
    const insert = vi.spyOn(db.cardDesigns, "insert").mockRejectedValueOnce(new Error("Datenbankfehler"));
    await expect(registerDriver({ firstName: "Test", lastName: "Fahrer", email: "partial@test.de", phone: "", password: "sicheres-passwort", terms: "on" }))
      .rejects.toThrow(/Datenbankfehler/);
    expect(await db.users.findOne({ email: "partial@test.de" })).toBeNull();
    expect(await db.driverProfiles.count()).toBe(0);
    insert.mockRestore();
  });
});

describe("Danke und Trinkgeld", () => {
  it("rechnet 3 € korrekt ab und bucht 2,50 € ins Guthaben", async () => {
    const { driver } = await makeDriver();
    const { paymentId, redirectUrl } = await startTip(driver.code, 300, null);
    expect(redirectUrl).toBe(`/zahlung/${paymentId}`);

    // Vor der Bestätigung zählt nichts.
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);

    await confirmPayment(paymentId);
    const stats = await getDriverStats(driver.id);
    expect(stats.balanceCents).toBe(250);
    expect(stats.today.tipCount).toBe(1);
    expect(stats.total.thanks).toBe(1);

    const tip = (await getDb().tips.findMany({ where: { driverId: driver.id } }))[0];
    expect(tip).toMatchObject({ grossCents: 300, driverCents: 250, platformGrossFeeCents: 50, paymentStatus: "succeeded" });
  });

  it("bucht eine doppelt gemeldete Zahlung nur einmal", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 500, null);
    await confirmPayment(paymentId);
    await confirmPayment(paymentId);
    const stats = await getDriverStats(driver.id);
    expect(stats.balanceCents).toBe(450);
    expect(stats.total.thanks).toBe(1);
  });

  it("lehnt Beträge unter 2 € ab", async () => {
    const { driver } = await makeDriver();
    await expect(startTip(driver.code, 100, null)).rejects.toThrow(/Möglich sind/);
  });

  it("nimmt bei pausierten oder gesperrten Zustellern nichts an", async () => {
    const { user, driver } = await makeDriver();
    await setDriverActive(driver, false);
    await expect(sendFreeThankYou(driver.code, null)).rejects.toThrow(/nicht aktiv/);

    await setDriverActive({ ...driver, active: false }, true);
    await getDb().users.update(user.id, { blockedAt: new Date().toISOString() });
    await expect(startTip(driver.code, 300, null)).rejects.toThrow(/nicht aktiv/);
  });

  it("speichert genau eine Nachricht pro Danke", async () => {
    const { driver } = await makeDriver();
    const { thankYouId } = await sendFreeThankYou(driver.code, null);
    await attachMessage(thankYouId, "hochtragen", null);
    await attachMessage(thankYouId, "wetter", "Überschreiben?");
    const thankYou = await getDb().thankYous.get(thankYouId);
    expect(thankYou).toMatchObject({ presetId: "hochtragen", message: null });
  });

  it("nimmt erstattete Zahlungen aus dem Guthaben", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    await confirmPayment(paymentId, { providerIntentId: "pi_test" });
    await markRefunded("pi_test");
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });

  it("bucht eine Erstattung vor einem verspäteten Erfolgsereignis nicht erneut gut", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    await markRefunded("pi_early", paymentId);
    await confirmPayment(paymentId, { providerIntentId: "pi_early" });
    expect((await getDb().payments.get(paymentId))?.status).toBe("refunded");
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });

  it("verwendet kein veraltetes Connect-Zielkonto für einen neuen Checkout", async () => {
    const { driver } = await makeDriver();
    await getDb().driverProfiles.update(driver.id, { payoutAccountId: "acct_stale", payoutReady: true });
    const readiness = vi.spyOn(demoPaymentProvider, "isAccountReady").mockResolvedValueOnce(false);
    const { tipId } = await startTip(driver.code, 300, null);
    expect((await getDb().tips.get(tipId))?.destinationAccountId).toBeNull();
    readiness.mockRestore();
  });

  it("erstellt in Vercel Production keine simulierten Trinkgelder", async () => {
    const { driver } = await makeDriver();
    vi.stubEnv("VERCEL_ENV", "production");
    try {
      await expect(startTip(driver.code, 300, null)).rejects.toThrow(/gerade nicht verfügbar/);
      expect(await getDb().tips.count()).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("holt eine unterbrochene Verbuchung beim nächsten Webhook nach", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 200, null);
    await getDb().payments.update(paymentId, { status: "succeeded" });
    await confirmPayment(paymentId);
    expect((await getDriverStats(driver.id)).balanceCents).toBe(150);
  });

  it("vergibt Meilensteine für erstes Danke und erstes Trinkgeld", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 200, null);
    await confirmPayment(paymentId);
    const types = (await getDb().milestones.findMany({ where: { driverId: driver.id } })).map((m) => m.type);
    expect(types).toEqual(expect.arrayContaining(["thank_you_count", "first_tip"]));
  });
});

describe("Auszahlung", () => {
  it("überweist erst mit Auszahlungskonto und verteilt die Gebühr", async () => {
    const { user, driver } = await makeDriver();
    for (const amount of [200, 300, 500]) await confirmPayment((await startTip(driver.code, amount, null)).paymentId);

    await expect(payoutDriver(driver.id)).rejects.toThrow(/Auszahlungskonto/);

    await startPayoutOnboarding(user, driver);
    const withAccount = (await getDb().driverProfiles.get(driver.id))!;
    expect(await refreshPayoutReadiness(withAccount)).toBe(true);

    const payout = await payoutDriver(driver.id);
    expect(payout).toMatchObject({ amountCents: 150 + 250 + 450, transferredCents: 850, status: "paid" });

    const tips = await getDb().tips.findMany({ where: { driverId: driver.id } });
    expect(tips.every((t) => t.payoutStatus === "paid_out")).toBe(true);
    expect(tips.reduce((s, t) => s + t.payoutFeeCents, 0)).toBe(payout!.feeCents);
    for (const tip of tips) {
      expect(tip.platformNetRevenueCents).toBe(tip.platformGrossFeeCents - tip.paymentProviderFeeCents - tip.payoutFeeCents);
    }
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });

  it("verhindert parallele Doppelüberweisungen", async () => {
    const { user, driver } = await makeDriver();
    await confirmPayment((await startTip(driver.code, 300, null)).paymentId);
    await startPayoutOnboarding(user, driver);
    await refreshPayoutReadiness((await getDb().driverProfiles.get(driver.id))!);
    const results = await Promise.allSettled([payoutDriver(driver.id), payoutDriver(driver.id)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await getDb().payouts.findMany({ where: { driverId: driver.id } })).toHaveLength(1);
    expect((await getDriverStats(driver.id)).balanceCents).toBe(0);
  });

  it("setzt nach einem Transferfehler dieselbe vorgemerkte Auszahlung fort", async () => {
    const { user, driver } = await makeDriver();
    await confirmPayment((await startTip(driver.code, 300, null)).paymentId);
    await startPayoutOnboarding(user, driver);
    await refreshPayoutReadiness((await getDb().driverProfiles.get(driver.id))!);
    const transfer = vi.spyOn(demoPaymentProvider, "createPayout").mockRejectedValueOnce(new Error("temporär"));
    await expect(payoutDriver(driver.id)).rejects.toThrow(/nicht abgeschlossen/);
    const pending = (await getDb().payouts.findMany({ where: { driverId: driver.id } }))[0];
    expect(pending.status).toBe("pending");
    const result = await payoutDriver(driver.id);
    expect(result?.id).toBe(pending.id);
    expect(await getDb().payouts.findMany({ where: { driverId: driver.id } })).toHaveLength(1);
    transfer.mockRestore();
  });
});

describe("Privatsphäre", () => {
  it("gibt öffentlich nur Freigegebenes heraus", async () => {
    const { user, driver } = await makeDriver();
    const publicView = toPublicDriver({ ...driver, city: "Köln", providerId: "dhl", providerPublic: false }, user);
    const json = JSON.stringify(publicView);
    expect(publicView.name).toBe("Max");
    expect(publicView.provider).toBeNull();
    expect(json).not.toContain(user.email);
    expect(json).not.toContain("Müller");
    expect(json).not.toContain("Köln");
    expect(json).not.toContain("+49");
  });

  it("zeigt kein privates Foto", async () => {
    const { user, driver } = await makeDriver();
    const view = toPublicDriver({ ...driver, photoKey: "avatars/x/y", photoPublic: false }, user);
    expect(view.photoUrl).toBeNull();
  });

  it("verwendet in öffentlichen Foto-URLs den Danke-Code statt einer internen UUID", async () => {
    const { user, driver } = await makeDriver();
    const view = toPublicDriver({ ...driver, photoKey: "avatars/private", photoPublic: true }, user);
    expect(view.photoUrl).toContain(`/api/media/avatar/${driver.code}`);
    expect(JSON.stringify(view)).not.toContain(driver.id);
    expect(JSON.stringify(view)).not.toContain("avatars/private");
  });
});

describe("Kundenkonto und Favoriten", () => {
  it("speichert Lieferanten – auch direkt bei der Registrierung", async () => {
    const { driver } = await makeDriver();
    const customer = await makeCustomer(driver.code);
    let favorites = await listFavorites(customer.id);
    expect(favorites).toHaveLength(1);
    expect(favorites[0].driver.name).toBe("Max");

    await addFavoriteByCode(customer.id, driver.code);
    favorites = await listFavorites(customer.id);
    expect(favorites).toHaveLength(1);
  });

  it("verknüpft Danke mit dem Kundenkonto, nie umgekehrt sichtbar für den Zusteller", async () => {
    const { driver } = await makeDriver();
    const customer = await makeCustomer();
    await sendFreeThankYou(driver.code, customer.id);
    const stats = await getDriverStats(driver.id);
    expect(stats.recentThankYous[0].customerId).toBe(customer.id); // intern gespeichert …
    // … aber die API entfernt den Bezug (siehe api.test.ts).
  });

  it("lässt einen Kunden keine Favoriten eines anderen Kunden ändern", async () => {
    const { driver } = await makeDriver();
    const owner = await makeCustomer();
    const stranger = await makeCustomer();
    const favorite = await addFavoriteByCode(owner.id, driver.code);
    await expect(renameFavorite(stranger.id, favorite.id, "Fremd")).rejects.toThrow();
    await expect(removeFavorite(stranger.id, favorite.id)).rejects.toThrow();
    expect((await listFavorites(owner.id))[0].nickname).toBeNull();
  });
});

describe("Passwort vergessen", () => {
  it("setzt ein neues Passwort, meldet alte Sessions ab und ist nur einmal nutzbar", async () => {
    const { user } = await makeDriver();
    const { link } = await requestPasswordReset(user.email);
    const token = new URL(link!).searchParams.get("token")!;

    const updated = await completePasswordReset(token, "ganz-neues-passwort");
    expect(updated.tokenVersion).toBe(1);
    await expect(authenticate({ email: user.email, password: "ganz-neues-passwort" })).resolves.toMatchObject({ id: user.id });
    await expect(authenticate({ email: user.email, password: "sicheres-passwort" })).rejects.toThrow(/falsch/);
    await expect(completePasswordReset(token, "noch-ein-passwort")).rejects.toThrow(/nicht mehr gültig/);
  });

  it("verrät nicht, ob eine Adresse existiert", async () => {
    await expect(requestPasswordReset("gibt-es-nicht@test.de")).resolves.toEqual({ link: null });
  });

  it("lässt einen Reset-Link auch bei parallelen Anfragen nur einmal zu", async () => {
    const { user } = await makeDriver();
    const { link } = await requestPasswordReset(user.email);
    const token = new URL(link!).searchParams.get("token")!;
    const results = await Promise.allSettled([
      completePasswordReset(token, "neues-passwort-1"),
      completePasswordReset(token, "neues-passwort-2"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expect(completePasswordReset("ungültig", "neues-passwort-3")).rejects.toThrow(/nicht mehr gültig/);
  });

  it("gibt in Produktion ohne E-Mail-Dienst keinen unerreichbaren Reset-Link aus", async () => {
    const { user } = await makeDriver();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    try {
      await expect(requestPasswordReset(user.email)).rejects.toThrow(/gerade nicht verfügbar/);
      expect(await getDb().passwordResets.count()).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("Karten", () => {
  it("prüft den Kartentext", () => {
    expect(() => parseInput(cardDesignSchema, { layout: "classic", headline: "x".repeat(61), showPhoto: false, showProvider: true })).toThrow(/60/);
    expect(parseInput(cardDesignSchema, { layout: "brand", headline: "  ", showPhoto: false, showProvider: true }).headline).toContain("Danke");
  });

  it("legt Bestellungen an und friert das Design ein", async () => {
    const { user, driver } = await makeDriver();
    const { order, paymentUrl } = await createCardOrder(user, driver, {
      quantity: 3,
      shippingName: "Max Müller",
      shippingStreet: "Musterstraße 1",
      shippingPostalCode: "50667",
      shippingCity: "Köln",
      reorderOf: "",
    });
    expect(paymentUrl).toBeNull(); // Im Testbetrieb kostenlos.
    expect(order).toMatchObject({ status: "requested", totalCents: 0, paymentStatus: "not_required" });
    expect(order.design.code).toBe(driver.code);

    const shipped = await updateCardOrderStatus(order.id, "shipped", { carrier: "DHL", trackingNumber: "123" });
    expect(shipped.shippedAt).toBeTruthy();
  });

  it("gibt eine kostenpflichtige Karte erst nach bestätigter Zahlung frei", async () => {
    const { user, driver } = await makeDriver();
    const { order } = await createCardOrder(user, driver, {
      quantity: 1,
      shippingName: "Max Müller",
      shippingStreet: "Musterstraße 1",
      shippingPostalCode: "50667",
      shippingCity: "Köln",
      reorderOf: "",
    });
    await getDb().cardOrders.update(order.id, { totalCents: 490, paymentStatus: "pending" });
    await expect(updateCardOrderStatus(order.id, "shipped", {})).rejects.toThrow(/noch nicht bezahlt/);
    await getDb().cardOrders.update(order.id, { paymentStatus: "paid" });
    await expect(updateCardOrderStatus(order.id, "shipped", {})).resolves.toMatchObject({ status: "shipped" });
  });

  it("sperrt den Versand einer nachträglich erstatteten Karte", async () => {
    const { user, driver } = await makeDriver();
    const { order } = await createCardOrder(user, driver, {
      quantity: 1,
      shippingName: "Max Müller",
      shippingStreet: "Musterstraße 1",
      shippingPostalCode: "50667",
      shippingCity: "Köln",
      reorderOf: "",
    });
    await getDb().cardOrders.update(order.id, { totalCents: 490, paymentStatus: "pending" });
    const paymentId = "card-payment-test";
    await getDb().payments.insert({
      id: paymentId, purpose: "card_order", referenceId: order.id, provider: "demo",
      providerPaymentId: "demo_card", providerIntentId: "pi_card", amountCents: 490,
      currency: "EUR", status: "pending", method: null, failureReason: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await confirmPayment(paymentId, { providerIntentId: "pi_card" });
    await markRefunded("pi_card");
    expect((await getDb().cardOrders.get(order.id))?.paymentStatus).toBe("refunded");
    await expect(updateCardOrderStatus(order.id, "shipped", {})).rejects.toThrow(/noch nicht bezahlt/);
  });
});
