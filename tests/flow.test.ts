import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { authenticate, completePasswordReset, requestPasswordReset } from "@/server/services/auth";
import { confirmPayment, markRefunded, sendFreeThankYou, startTip, attachMessage } from "@/server/services/thanks";
import { getDriverStats } from "@/server/services/stats";
import { payoutDriver, refreshPayoutReadiness, startPayoutOnboarding } from "@/server/services/payouts";
import { addFavoriteByCode, listFavorites } from "@/server/services/favorites";
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
});
