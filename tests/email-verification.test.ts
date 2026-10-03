import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as apiLogin } from "@/app/api/v1/auth/login/route";
import { getDb } from "@/lib/db";
import {
  assertEmailVerified,
  completePasswordReset,
  confirmEmail,
  registerCustomer,
  registerDriver,
  requestEmailVerification,
  requestPasswordReset,
} from "@/server/services/auth";
import { cardOrdersAvailable, createCardOrder } from "@/server/services/cards";
import { startPayoutOnboarding } from "@/server/services/payouts";
import { deleteAccount } from "@/server/services/profile";
import { recordScanFrom } from "@/server/services/thanks";
import { getBearerSession, signSessionToken } from "@/server/session";
import { demoPaymentProvider } from "@/server/payments/demo";
import { freshDb, makeDriver } from "./helpers";

let mails: { to: string; subject: string; text: string }[] = [];

beforeEach(() => {
  freshDb();
  mails = [];
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.stubEnv("RESEND_API_KEY", "local-test-token");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    mails.push({ to: body.to[0], subject: body.subject, text: body.text });
    return new Response("{}", { status: 200 });
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

let counter = 0;
const driverInput = () => ({
  firstName: "Max", lastName: "Müller", email: `bestaetigung${++counter}@test.de`, phone: "", password: "sicheres-passwort", terms: "on" as const,
});
const tokenFrom = (text: string) => decodeURIComponent(/email-bestaetigen\?token=([^\s"<]+)/.exec(text)?.[1] ?? "");

describe("E-Mail-Bestätigung", () => {
  it("neue Konten sind unbestätigt und bekommen den Link mit der Willkommensmail", async () => {
    const driver = await registerDriver(driverInput());
    const customer = await registerCustomer({ firstName: "Lena", email: `kundin-b${++counter}@test.de`, password: "sicheres-passwort", terms: "on", saveCode: "" });
    for (const user of [driver, customer]) {
      expect(user.emailVerifiedAt).toBeNull();
      const mail = mails.find((m) => m.to === user.email)!;
      expect(mail.subject).toMatch(/Willkommen/);
      expect(tokenFrom(mail.text)).not.toBe("");
    }
  });

  it("bestätigt per Link genau dieses Konto – mehrfach harmlos, ohne Anmeldung", async () => {
    const user = await registerDriver(driverInput());
    const token = tokenFrom(mails[0].text);
    const confirmed = await confirmEmail(token);
    expect(confirmed.id).toBe(user.id);
    expect(confirmed.emailVerifiedAt).not.toBeNull();
    const first = confirmed.emailVerifiedAt;
    expect((await confirmEmail(token)).emailVerifiedAt).toBe(first);
    // Der Bestätigungslink ist kein Sitzungstoken – und ein Sitzungstoken kein Bestätigungslink.
    const asSession = new Request("http://localhost/api/v1/me", { headers: { authorization: `Bearer ${token}` } });
    expect(await getBearerSession(asSession)).toBeNull();
    await expect(confirmEmail(await signSessionToken(user))).rejects.toMatchObject({ code: "verification_invalid" });
    // Auch mit dem Sitzungsschlüssel signiert gilt ein Token mit Zweck nie als Sitzung.
    const sessionKey = new TextEncoder().encode("lieferdank-dev-secret-nur-lokal-nicht-produktiv");
    const withPurpose = await new SignJWT({ sub: user.id, v: 0, typ: "email_verification" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1d").sign(sessionKey);
    const bearer = (value: string) => new Request("http://localhost/api/v1/me", { headers: { authorization: `Bearer ${value}` } });
    expect(await getBearerSession(bearer(withPurpose))).toBeNull();
    expect((await getBearerSession(bearer(await signSessionToken(user))))?.user.id).toBe(user.id);
  });

  it("weist manipulierte, abgelaufene, fremde und gesperrte Links ab", async () => {
    const user = await registerDriver(driverInput());
    const token = tokenFrom(mails[0].text);
    const [header, payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), sub: crypto.randomUUID() })).toString("base64url");
    // Mit dem rohen AUTH_SECRET-Fallback statt des abgeleiteten Schlüssels signiert.
    const wrongKey = await new SignJWT({ sub: user.id, email: user.email, typ: "email_verification" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1d").sign(new TextEncoder().encode("lieferdank-dev-secret-nur-lokal-nicht-produktiv"));
    for (const bad of ["", "abc", `${header}.${forged}.${signature}`, `${token}x`, wrongKey, "a".repeat(5000)]) {
      await expect(confirmEmail(bad)).rejects.toMatchObject({ code: "verification_invalid" });
    }
    vi.useFakeTimers({ now: Date.now() + 8 * 24 * 60 * 60_000, toFake: ["Date"] });
    await expect(confirmEmail(token)).rejects.toMatchObject({ code: "verification_invalid" });
    vi.useRealTimers();
    await getDb().users.update(user.id, { blockedAt: new Date().toISOString() });
    await expect(confirmEmail(token)).rejects.toMatchObject({ code: "verification_invalid" });
    expect((await getDb().users.get(user.id))?.emailVerifiedAt).toBeNull();
  });

  it("ein Link gilt nur für die Adresse, an die er ging", async () => {
    const user = await registerDriver(driverInput());
    const token = tokenFrom(mails[0].text);
    await getDb().users.update(user.id, { email: `andere${counter}@test.de` });
    await expect(confirmEmail(token)).rejects.toMatchObject({ code: "verification_invalid" });
    await getDb().users.update(user.id, { email: user.email });
    // Ein gelöschtes Konto bekommt eine Platzhalteradresse – der alte Link greift dann nicht mehr.
    await deleteAccount(user);
    await expect(confirmEmail(token)).rejects.toMatchObject({ code: "verification_invalid" });
    expect((await getDb().users.get(user.id))?.emailVerifiedAt).toBeNull();
  });

  it("erneut senden nur für unbestätigte Konten", async () => {
    const user = await registerDriver(driverInput());
    mails = [];
    const { link } = await requestEmailVerification(user);
    expect(link).toContain("/email-bestaetigen?token=");
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe("Bitte bestätige deine E-Mail-Adresse");
    await confirmEmail(tokenFrom(mails[0].text));
    mails = [];
    expect((await requestEmailVerification((await getDb().users.get(user.id))!)).link).toBeNull();
    expect(mails).toHaveLength(0);
  });

  it("ein eingelöster Passwort-Reset bestätigt die Adresse mit", async () => {
    const user = await registerDriver(driverInput());
    const { link } = await requestPasswordReset(user.email);
    const token = new URL(link!).searchParams.get("token")!;
    const updated = await completePasswordReset(token, "neues-passwort-123");
    expect(updated.emailVerifiedAt).not.toBeNull();
    expect((await getDb().users.get(user.id))?.emailVerifiedAt).toBe(updated.emailVerifiedAt);
  });
});

describe("Sicherheitskritische Funktionen nur mit bestätigter Adresse", () => {
  it("kein Stripe-Auszahlungskonto ohne Bestätigung", async () => {
    const { user, driver } = await makeDriver({ emailVerified: false });
    const create = vi.spyOn(demoPaymentProvider, "createConnectedAccount");
    await expect(startPayoutOnboarding(user, driver)).rejects.toMatchObject({ code: "email_unverified", status: 403 });
    expect(create).not.toHaveBeenCalled();
    expect((await getDb().driverProfiles.get(driver.id))?.payoutAccountId).toBeNull();

    await getDb().users.update(user.id, { emailVerifiedAt: new Date().toISOString() });
    const verified = (await getDb().users.get(user.id))!;
    await startPayoutOnboarding(verified, driver);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("keine Kartenbestellung ohne Bestätigung", async () => {
    const { user, driver } = await makeDriver({ emailVerified: false });
    await expect(createCardOrder(user, driver, {
      quantity: 1, shippingName: "Max Test", shippingStreet: "Weg 1", shippingPostalCode: "50667", shippingCity: "Köln", reorderOf: "",
    })).rejects.toMatchObject({ code: "email_unverified" });
    expect(await getDb().cardOrders.count()).toBe(0);
    expect(() => assertEmailVerified({ emailVerifiedAt: null })).toThrow(/bestätige/);
    expect(() => assertEmailVerified({ emailVerifiedAt: new Date().toISOString() })).not.toThrow();
  });
});

describe("Physische Karten", () => {
  it("sind in Production nur mit bezahlten Bestellungen verfügbar – überall dieselbe Regel", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("CARD_ORDERS_PAID", "");
    expect(cardOrdersAvailable()).toBe(false);
    const { user, driver } = await makeDriver();
    await expect(createCardOrder(user, driver, {
      quantity: 1, shippingName: "Max Test", shippingStreet: "Weg 1", shippingPostalCode: "50667", shippingCity: "Köln", reorderOf: "",
    })).rejects.toMatchObject({ code: "card_orders_unavailable" });
    vi.stubEnv("CARD_ORDERS_PAID", "true");
    expect(cardOrdersAvailable()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("CARD_ORDERS_PAID", "");
    expect(cardOrdersAvailable()).toBe(true);
  });
});

describe("Missbrauchsschutz", () => {
  it("zählt Scans je Adresse und Lieferant höchstens alle 10 Minuten und deckelt pro Adresse", async () => {
    const { driver } = await makeDriver();
    const ip = `192.0.2.${++counter}`;
    for (let i = 0; i < 5; i++) await recordScanFrom(driver.id, ip);
    await recordScanFrom(driver.id, `198.51.100.${counter}`);
    expect(await getDb().scans.count({ where: { driverId: driver.id } })).toBe(2);

    const busy = `203.0.113.${counter}`;
    for (let i = 0; i < 70; i++) await recordScanFrom(`${driver.id.slice(0, -2)}${String(i).padStart(2, "0")}`, busy);
    expect(await getDb().scans.count()).toBe(2 + 60);
  });

  it("bremst Anmeldeversuche pro Konto auch über viele Adressen", async () => {
    const { user } = await makeDriver();
    const attempt = (n: number) => apiLogin(new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `100.64.${counter}.${n}` },
      body: JSON.stringify({ email: user.email, password: "falsch-falsch" }),
    }), { params: Promise.resolve({}) });
    const statuses = [];
    for (let i = 0; i < 22; i++) statuses.push((await attempt(i)).status);
    expect(statuses.slice(0, 20).every((status) => status === 401)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
  });
});
