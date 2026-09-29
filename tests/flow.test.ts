import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { authenticate, completePasswordReset, localResetLink, registerDriver, requestPasswordReset } from "@/server/services/auth";
import { confirmPayment, failPayment, markRefunded, sendFreeThankYou, startTip, attachMessage } from "@/server/services/thanks";
import { getDriverStats } from "@/server/services/stats";
import { refreshPayoutReadiness, startPayoutOnboarding } from "@/server/services/payouts";
import { addFavoriteByCode, listFavorites, removeFavorite, renameFavorite } from "@/server/services/favorites";
import { deleteAccount, requestBadge, setDriverActive, updateDriverProfile } from "@/server/services/profile";
import { toPublicDriver } from "@/server/services/drivers";
import { cardDesignSchema, cancelCardOrder, createCardOrder, updateCardOrderStatus } from "@/server/services/cards";
import { parseInput } from "@/server/services/auth";
import { regenerateCode, reviewBadge, setProviderVerified, setUserBlocked } from "@/server/services/admin";
import { freshDb, makeCustomer, makeDriver } from "./helpers";

beforeEach(() => {
  freshDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("Registrierung", () => {
  it("gibt Reset-Entwicklungslinks nicht in Vercel Preview heraus", async () => {
    const link = "https://lieferdank.de/passwort-neu?token=test";
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(localResetLink(link)).toBeUndefined();
    vi.stubEnv("VERCEL_ENV", "");
    expect(localResetLink(link)).toBe(link);
    vi.stubEnv("NODE_ENV", "production");
    expect(localResetLink(link)).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("blockiert Supabase-Zugriff im Preview ohne separates Testprojekt", () => {
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(() => getDb()).toThrow(/separates Supabase-Testprojekt/);
    vi.unstubAllEnvs();
  });
  it("vergibt sofort einen funktionierenden Code – ohne Verifizierung", async () => {
    const { driver } = await makeDriver();
    expect(driver.code).toMatch(/^LD-[23456789A-HJ-NP-Z]{10}$/);
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

  it("erzeugt 10-stellige, nicht erratbare QR-Identifier ohne Wiederverwendung", async () => {
    const { generateLieferdankCode } = await import("@/lib/id");
    const codes = new Set(Array.from({ length: 10_000 }, () => generateLieferdankCode()));
    expect(codes.size).toBe(10_000);
    for (const code of codes) expect(code).toMatch(/^LD-[23456789A-HJ-NP-Z]{10}$/);
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
  it("rechnet 3 € mit 0,60 € Application Fee und ohne Lieferdank-Wallet ab", async () => {
    const { driver } = await makeDriver();
    const { paymentId, redirectUrl } = await startTip(driver.code, 300, null);
    expect(redirectUrl).toBe(`/zahlung/${paymentId}`);

    // Vor der Bestätigung zählt nichts.
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);

    await confirmPayment(paymentId);
    const stats = await getDriverStats(driver.id);
    expect(stats.driverShareBeforeStripeCents).toBe(240);
    expect(stats.today.tipCount).toBe(1);
    expect(stats.total.thanks).toBe(1);

    const tip = (await getDb().tips.findMany({ where: { driverId: driver.id } }))[0];
    expect(tip).toMatchObject({ grossCents: 300, driverCents: 240, platformGrossFeeCents: 60, paymentStatus: "succeeded" });
  });

  it("bucht eine doppelt gemeldete Zahlung nur einmal", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 500, null);
    await confirmPayment(paymentId);
    await confirmPayment(paymentId);
    const stats = await getDriverStats(driver.id);
    expect(stats.driverShareBeforeStripeCents).toBe(400);
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
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
  });

  it("bucht eine Erstattung vor einem verspäteten Erfolgsereignis nicht erneut gut", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    await markRefunded("pi_early", paymentId);
    await confirmPayment(paymentId, { providerIntentId: "pi_early" });
    expect((await getDb().payments.get(paymentId))?.status).toBe("review_required");
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
  });

  it("merkt kumulative Teil-Erstattungen monoton, auch bei verspäteten Events", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    await confirmPayment(paymentId, { providerIntentId: "pi_partial_order" });
    for (const cents of [100, 200, 300, 100, 300]) {
      await markRefunded("pi_partial_order", paymentId, cents);
    }
    const payment = (await getDb().payments.get(paymentId))!;
    expect(payment.refundedAmountCents).toBe(300);
    expect(payment.status).toBe("review_required");
    expect(payment.failureReason).toMatch(/Abgleich|Teil-Erstattung|Abstimmung/);
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
  });

  it("hält keinen Fahrerbetrag auf dem Plattformkonto", async () => {
    const { driver } = await makeDriver();
    const { tipId, paymentId } = await startTip(driver.code, 300, null);
    await confirmPayment(paymentId);
    expect((await getDb().tips.get(tipId))?.destinationAccountId).toMatch(/^demo_acct_/);
    expect((await getDb().tips.get(tipId))?.payoutStatus).toBe("in_balance");
    expect(await getDb().payouts.count()).toBe(0);
  });

  it("nimmt strittige Zahlungen aus der Statistik", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 300, null);
    await confirmPayment(paymentId, { providerIntentId: "pi_disputed" });
    const { markDisputed } = await import("@/server/services/thanks");
    await markDisputed("pi_disputed");
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(0);
    expect((await getDriverStats(driver.id)).inReviewCents).toBe(240);
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
    expect((await getDriverStats(driver.id)).driverShareBeforeStripeCents).toBe(150);
  });

  it("vergibt Meilensteine für erstes Danke und erstes Trinkgeld", async () => {
    const { driver } = await makeDriver();
    const { paymentId } = await startTip(driver.code, 200, null);
    await confirmPayment(paymentId);
    const types = (await getDb().milestones.findMany({ where: { driverId: driver.id } })).map((m) => m.type);
    expect(types).toEqual(expect.arrayContaining(["thank_you_count", "first_tip"]));
  });
});

describe("Stripe-Onboarding", () => {
  it("erstellt höchstens ein Testkonto pro Fahrer und prüft Eigentum", async () => {
    const { user, driver } = await makeDriver();
    await startPayoutOnboarding(user, driver);
    const stored = (await getDb().driverProfiles.get(driver.id))!;
    expect(stored.payoutAccountId).toMatch(/^demo_acct_/);
    expect(await refreshPayoutReadiness(stored)).toBe(true);
    await startPayoutOnboarding(user, stored);
    expect((await getDb().driverProfiles.get(driver.id))?.payoutAccountId).toBe(stored.payoutAccountId);
    expect(await getDb().payouts.count()).toBe(0);
  });
});

describe("Privatsphäre", () => {
  it("entfernt beim Kundenlöschen die Verknüpfung zu Dankes- und Zahlungsdaten", async () => {
    const { driver } = await makeDriver();
    const customer = await makeCustomer();
    const thanks = await sendFreeThankYou(driver.code, customer.id);
    const tip = await startTip(driver.code, 200, customer.id);
    await deleteAccount(customer);
    expect((await getDb().thankYous.get(thanks.thankYouId))?.customerId).toBeNull();
    expect((await getDb().tips.get(tip.tipId))?.customerId).toBeNull();
  });
  it("verweigert Neu-Bestellungen mit einer fremden Vorbestellung", async () => {
    const a = await makeDriver();
    const b = await makeDriver();
    const previous = await createCardOrder(b.user, b.driver, {
      quantity: 1, shippingName: "B Test", shippingStreet: "Weg 1", shippingPostalCode: "50667", shippingCity: "Köln", reorderOf: "",
    });
    await expect(createCardOrder(a.user, a.driver, {
      quantity: 1, shippingName: "A Test", shippingStreet: "Weg 2", shippingPostalCode: "50667", shippingCity: "Köln", reorderOf: previous.order.id,
    })).rejects.toThrow(/nicht gefunden/);
    expect(await getDb().cardOrders.count()).toBe(1);
  });
  it("weist fremde Fahrer-Objekte an Profil, Karte, Badge und Connect zurück", async () => {
    const a = await makeDriver();
    const b = await makeDriver();
    const profile = parseInput((await import("@/server/services/profile")).profileSchema, {
      firstName: "Angreifer", lastName: "Test", nameDisplay: "first", customName: "",
      providerId: "", providerPublic: true, tagline: "", bio: "", city: "", phone: "", notifyOnTip: true,
    });
    await expect(updateDriverProfile(a.user, b.driver, profile)).rejects.toThrow(/gehört nicht/);
    await expect(requestBadge(a.user, b.driver, "Ich bin Zusteller")).rejects.toThrow(/gehört nicht/);
    await expect(startPayoutOnboarding(a.user, b.driver)).rejects.toThrow(/gehört nicht/);
    await expect(createCardOrder(a.user, b.driver, {
      quantity: 1, shippingName: "A Test", shippingStreet: "Weg 1", shippingPostalCode: "50667", shippingCity: "Köln", reorderOf: "",
    })).rejects.toThrow(/gehört nicht/);
    expect((await getDb().users.get(a.user.id))?.firstName).not.toBe("Angreifer");
    expect(await getDb().payouts.count()).toBe(0);
  });

  it("verweigert Admin-Serviceaktionen mit normalem Fahrer als Akteur", async () => {
    const a = await makeDriver();
    const b = await makeDriver();
    await expect(reviewBadge(a.user, b.driver.id, "verified", "")).rejects.toThrow(/Administrator/);
    await expect(setProviderVerified(a.user, b.driver.id, true)).rejects.toThrow(/Administrator/);
    await expect(setUserBlocked(a.user, b.user.id, true, "Angriff")).rejects.toThrow(/Administrator/);
    await expect(regenerateCode(a.user, b.driver.id, "Angriff")).rejects.toThrow(/Administrator/);
    expect((await getDb().driverProfiles.get(b.driver.id))?.code).toBe(b.driver.code);
    expect((await getDb().users.get(b.user.id))?.blockedAt).toBeNull();
  });
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

  it("verhindert, dass zwei verschiedene offene Reset-Links das Passwort nacheinander überschreiben", async () => {
    const { user } = await makeDriver();
    const first = await requestPasswordReset(user.email);
    const oldRow = (await getDb().passwordResets.findMany({ where: { userId: user.id } }))[0];
    const second = await requestPasswordReset(user.email);
    // Simuliert zwei gleichzeitig gestartete Reset-Anfragen vor dem Sperren des alten Links.
    await getDb().passwordResets.update(oldRow.id, { usedAt: null });
    const tokens = [first.link, second.link].map((link) => new URL(link!).searchParams.get("token")!);
    const results = await Promise.allSettled(tokens.map((token, index) => completePasswordReset(token, `neues-passwort-${index}`)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await getDb().users.get(user.id))?.tokenVersion).toBe(1);
    for (const token of tokens) await expect(completePasswordReset(token, "dritter-versuch")).rejects.toThrow(/nicht mehr gültig/);
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
      providerPaymentId: "demo_card", providerIntentId: "pi_card", amountCents: 490, refundedAmountCents: 0,
      currency: "EUR", status: "pending", method: null, failureReason: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await confirmPayment(paymentId, { providerIntentId: "pi_card" });
    await markRefunded("pi_card");
    expect((await getDb().cardOrders.get(order.id))?.paymentStatus).toBe("refunded");
    await expect(updateCardOrderStatus(order.id, "shipped", {})).rejects.toThrow(/noch nicht bezahlt/);
  });

  it("verhindert die Stornierung einer noch zahlbaren Karte", async () => {
    const { user, driver } = await makeDriver();
    const { order } = await createCardOrder(user, driver, {
      quantity: 1, shippingName: "Max Müller", shippingStreet: "Musterstraße 1",
      shippingPostalCode: "50667", shippingCity: "Köln", reorderOf: "",
    });
    await getDb().cardOrders.update(order.id, { totalCents: 490, paymentStatus: "pending" });
    await expect(cancelCardOrder(driver.id, order.id)).rejects.toThrow(/Klärung der Zahlung/);
    await expect(updateCardOrderStatus(order.id, "cancelled", {})).rejects.toThrow(/Klärung der Zahlung/);
  });

  it("verhindert Versand nach fehlgeschlagener Zahlung und markiert späten Erfolg nach Storno", async () => {
    const { user, driver } = await makeDriver();
    const { order } = await createCardOrder(user, driver, {
      quantity: 1, shippingName: "Max Müller", shippingStreet: "Musterstraße 1",
      shippingPostalCode: "50667", shippingCity: "Köln", reorderOf: "",
    });
    await getDb().cardOrders.update(order.id, { totalCents: 490, paymentStatus: "pending" });
    const paymentId = "card-failure-test";
    await getDb().payments.insert({
      id: paymentId, purpose: "card_order", referenceId: order.id, provider: "demo",
      providerPaymentId: "demo_card_failed", providerIntentId: null, amountCents: 490, refundedAmountCents: 0,
      currency: "EUR", status: "pending", method: null, failureReason: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await failPayment(paymentId, "Abgelaufen");
    expect((await getDb().cardOrders.get(order.id))?.paymentStatus).toBe("failed");
    await expect(updateCardOrderStatus(order.id, "shipped", {})).rejects.toThrow(/noch nicht bezahlt/);
    await cancelCardOrder(driver.id, order.id);
    await confirmPayment(paymentId, { providerIntentId: "pi_late_card" });
    expect((await getDb().payments.get(paymentId))?.status).toBe("review_required");
    expect((await getDb().cardOrders.get(order.id))?.paymentStatus).toBe("review_required");
  });

  it("versendet keine Karte, wenn ein Refund zwischen Prüfung und Statuswechsel eintrifft", async () => {
    const { user, driver } = await makeDriver();
    const { order } = await createCardOrder(user, driver, {
      quantity: 1, shippingName: "Max Müller", shippingStreet: "Musterstraße 1",
      shippingPostalCode: "50667", shippingCity: "Köln", reorderOf: "",
    });
    const db = getDb();
    await db.cardOrders.update(order.id, { totalCents: 490, paymentStatus: "paid" });
    const original = db.cardOrders.updateIf.bind(db.cardOrders);
    vi.spyOn(db.cardOrders, "updateIf").mockImplementationOnce(async (id, where, patch) => {
      await db.cardOrders.update(id, { paymentStatus: "refunded" });
      return original(id, where, patch);
    });
    await expect(updateCardOrderStatus(order.id, "shipped", {})).rejects.toThrow(/geändert/);
    expect((await db.cardOrders.get(order.id))?.status).toBe("requested");
    vi.restoreAllMocks();
  });
});
