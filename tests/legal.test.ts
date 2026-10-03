import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as retentionCron } from "@/app/api/cron/aufbewahrung/route";
import { getDb } from "@/lib/db";
import { OPERATOR, WITHDRAWAL_FORM_LINES, withdrawalInstructions } from "@/lib/legal-content";
import { newId } from "@/lib/id";
import { concludeTippingContract, TIPPING_CONTRACT_ACTION } from "@/server/services/payouts";
import { formatReceivedAt, submitLegalRequest } from "@/server/services/legal-requests";
import { deleteAccount } from "@/server/services/profile";
import { refundTip } from "@/server/services/refunds";
import { applyRetention } from "@/server/services/retention";
import { confirmPayment, recordScan, sendFreeThankYou, startTip } from "@/server/services/thanks";
import { freshDb, makeCustomer, makeDriver } from "./helpers";

type Mail = { to: string; subject: string; text: string };
let mails: Mail[] = [];
let ip = 0;
const nextIp = () => `203.0.113.${++ip % 250}`;

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
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("Formulare mit rechtlicher Funktion", () => {
  const now = new Date("2026-10-03T12:34:56Z");

  it("Kündigung: Weiterleitung und Bestätigung mit Inhalt, Datum und Uhrzeit (§ 312k BGB)", async () => {
    const result = await submitLegalRequest("kuendigung", {
      type: "ausserordentlich", reason: "Missbrauch meines Kontos", contract: "konto", name: "Max Test",
      account: "max@test.de", date: "", email: "max@test.de",
    }, nextIp(), now);
    expect(result.receivedAt).toBe("03.10.2026, 14:34:56 Uhr");
    const [toOperator, receipt] = mails;
    expect(toOperator.to).toBe(OPERATOR.email);
    expect(toOperator.subject).toContain("Kündigung");
    expect(receipt.to).toBe("max@test.de");
    expect(receipt.text).toContain("Eingegangen am 03.10.2026, 14:34:56 Uhr");
    for (const part of ["außerordentliche Kündigung", "Kündigungsgrund: Missbrauch meines Kontos", "Lieferdank-Konto (gesamte Nutzung)", "zum frühestmöglichen Zeitpunkt"]) {
      expect(receipt.text).toContain(part);
    }
  });

  it("Kündigung verlangt bei außerordentlicher Kündigung einen Grund", async () => {
    await expect(submitLegalRequest("kuendigung", {
      type: "ausserordentlich", reason: "", contract: "trinkgeld", name: "Max", account: "max@test.de", email: "max@test.de",
    }, nextIp(), now)).rejects.toMatchObject({ code: "invalid_input", field: "reason" });
    expect(mails).toHaveLength(0);
  });

  it("Widerruf: Eingangsbestätigung mit dem Inhalt der Erklärung (§ 356a BGB)", async () => {
    await submitLegalRequest("widerruf", { name: "Max Test", contract: "LD-ABCDEFGH", email: "max@test.de" }, nextIp(), now);
    expect(mails[0].to).toBe(OPERATOR.email);
    expect(mails[1].text).toContain("Ich widerrufe den von mir abgeschlossenen Vertrag über die Lieferdank-Trinkgeld-Funktion");
    expect(mails[1].text).toContain("Vertrag/Konto: LD-ABCDEFGH");
  });

  it("Meldung nach Art. 16 DSA: alle Pflichtangaben, Empfangsbestätigung ohne fremden Freitext", async () => {
    await expect(submitLegalRequest("meldung", {
      name: "Erika", email: "erika@test.de", location: "Danke-Seite LD-X", reason: "Das ist eine Beleidigung gegen mich.",
    }, nextIp(), now)).rejects.toMatchObject({ field: "goodFaith" });
    await submitLegalRequest("meldung", {
      name: "Erika", email: "erika@test.de", location: "Danke-Seite LD-X", reason: "Das ist eine Beleidigung gegen mich.", goodFaith: "on",
    }, nextIp(), now);
    expect(mails[0].text).toContain("Das ist eine Beleidigung gegen mich.");
    expect(mails[1].text).toContain("Gemeldete Fundstelle: Danke-Seite LD-X");
    expect(mails[1].text).not.toContain("Beleidigung");
  });

  it("Kontakt: keine Wiedergabe des Freitexts an die angegebene Adresse – kein Spam-Kanal", async () => {
    await submitLegalRequest("kontakt", { name: "", email: "fremd@test.de", message: "Kaufen Sie jetzt billige Uhren!" }, nextIp(), now);
    expect(mails[0].text).toContain("Kaufen Sie jetzt billige Uhren!");
    expect(mails[1].to).toBe("fremd@test.de");
    expect(mails[1].text).not.toContain("Uhren");
  });

  it("begrenzt Formulare pro E-Mail-Adresse und weist Zeilenumbrüche in Kopfzeilenfeldern ab", async () => {
    for (let i = 0; i < 3; i++) await submitLegalRequest("kontakt", { email: "viel@test.de", message: "Eine ganz normale Frage." }, nextIp(), now);
    await expect(submitLegalRequest("kontakt", { email: "viel@test.de", message: "Eine ganz normale Frage." }, nextIp(), now))
      .rejects.toMatchObject({ code: "rate_limited" });
    await expect(submitLegalRequest("widerruf", { name: "Max\r\nBcc: x@y.de", contract: "LD-1", email: "a@test.de" }, nextIp(), now))
      .rejects.toMatchObject({ field: "name" });
  });

  it("formatiert Zeitpunkte in deutscher Zeit", () => {
    expect(formatReceivedAt(new Date("2026-01-15T23:30:00Z"))).toBe("16.01.2026, 00:30:00 Uhr");
  });
});

describe("Trinkgeld-Funktion als entgeltlicher Vertrag", () => {
  it("verlangt das ausdrückliche Verlangen des Sofortbeginns und eine bestätigte E-Mail", async () => {
    const unverified = await makeDriver({ emailVerified: false });
    const { user, driver } = await makeDriver();
    mails = [];
    await expect(concludeTippingContract(unverified.user, unverified.driver, { immediateStart: true })).rejects.toMatchObject({ code: "email_unverified" });
    await expect(concludeTippingContract(user, driver, { immediateStart: false })).rejects.toMatchObject({ code: "contract_consent" });
    expect(await getDb().adminActions.count({ where: { action: TIPPING_CONTRACT_ACTION } })).toBe(0);
    expect(mails).toHaveLength(0);
  });

  it("bestätigt den Vertrag einmalig per E-Mail mit Widerrufsbelehrung und Formular (§ 312f BGB)", async () => {
    const { user, driver } = await makeDriver();
    mails = [];
    await concludeTippingContract(user, driver, { immediateStart: true });
    await concludeTippingContract(user, driver, { immediateStart: true });
    expect(await getDb().adminActions.count({ where: { action: TIPPING_CONTRACT_ACTION, targetId: driver.id } })).toBe(1);
    expect(mails).toHaveLength(1);
    const mail = mails[0];
    expect(mail.to).toBe(user.email);
    expect(mail.subject).toBe("Vertragsbestätigung: Lieferdank-Trinkgeld-Funktion");
    for (const part of [
      "0,50 € bei 2 €, 0,60 € bei 3 € und 1,00 € bei 5 € Trinkgeld", "unbefristet, ohne Mindestlaufzeit", "Widerrufsrecht",
      "binnen vierzehn Tagen ohne Angabe von Gründen", "/vertrag-widerrufen", "Muster-Widerrufsformular", "Du hast verlangt",
      "gesetzliche Gewährleistungsrecht",
    ]) expect(mail.text).toContain(part);
  });

  it("ist bei bestehendem Stripe-Konto bereits geschlossen", async () => {
    const { user, driver } = await makeDriver();
    await getDb().driverProfiles.update(driver.id, { payoutAccountId: "acct_bestehend" });
    mails = [];
    await concludeTippingContract(user, (await getDb().driverProfiles.get(driver.id))!, { immediateStart: false });
    expect(mails).toHaveLength(0);
  });

  it("Widerrufsbelehrung folgt dem gesetzlichen Muster für Dienstleistungen", () => {
    const text = withdrawalInstructions("https://lieferdank.de/vertrag-widerrufen").flatMap((s) => s.paragraphs).join(" ");
    for (const part of [
      "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.",
      "Sie können Ihr Widerrufsrecht auch online unter https://lieferdank.de/vertrag-widerrufen ausüben.",
      "Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll",
    ]) expect(text).toContain(part);
    expect(WITHDRAWAL_FORM_LINES.join(" ")).toContain("die Erbringung der folgenden Dienstleistung");
  });
});

describe("Erstattung durch Lieferdank", () => {
  it("informiert den Zusteller per E-Mail mit Betrag und Grund", async () => {
    const { user: driverUser, driver } = await makeDriver();
    const adminUser = await makeCustomer();
    await getDb().users.update(adminUser.id, { role: "admin" });
    const admin = (await getDb().users.get(adminUser.id))!;
    const { paymentId, tipId } = await startTip(driver.code, 300, null);
    await confirmPayment(paymentId);
    mails = [];
    await refundTip(admin, tipId, { amountCents: 100, expectedRefundedCents: 0, reason: "Doppelt bezahlt" });
    const notice = mails.find((mail) => mail.to === driverUser.email && mail.subject === "Ein Trinkgeld wurde erstattet");
    expect(notice?.text).toMatch(/1,00\s€ über Stripe an den Kunden erstattet/);
    expect(notice?.text).toContain("Grund: Doppelt bezahlt");
  });
});

describe("Datensparsamkeit bei der Kontolöschung", () => {
  it("löscht Danke, Nachrichten, Scans, Meilensteine, Design, Verifizierung und Favoriten – Buchungen bleiben", async () => {
    const { user, driver } = await makeDriver();
    const customer = await makeCustomer();
    const db = getDb();
    await sendFreeThankYou(driver.code, null, "d".repeat(32));
    await recordScan(driver.id);
    await db.milestones.insert({ id: newId(), driverId: driver.id, type: "thank_you_count", value: 1, achievedAt: new Date().toISOString() });
    await db.driverFavorites.insert({ id: newId(), customerId: customer.id, driverId: driver.id, nickname: null, createdAt: new Date().toISOString() });
    await db.verifications.insert({ id: newId(), userId: user.id, identityStatus: "unverified", driverStatus: "pending", documentNote: "Ausweis", reviewNote: null, updatedAt: new Date().toISOString() }).catch(() => undefined);
    const { paymentId } = await startTip(driver.code, 300, null);
    await confirmPayment(paymentId);

    await deleteAccount(user);
    expect(await db.thankYous.count({ where: { driverId: driver.id } })).toBe(0);
    expect(await db.scans.count({ where: { driverId: driver.id } })).toBe(0);
    expect(await db.milestones.count({ where: { driverId: driver.id } })).toBe(0);
    expect(await db.cardDesigns.count({ where: { driverId: driver.id } })).toBe(0);
    expect(await db.driverFavorites.count({ where: { driverId: driver.id } })).toBe(0);
    expect(await db.verifications.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.tips.count({ where: { driverId: driver.id } })).toBe(1);
    expect(await db.payments.get(paymentId)).not.toBeNull();
    expect((await db.driverProfiles.get(driver.id))?.active).toBe(false);
  });
});

describe("Löschfristen", () => {
  it("löscht nur abgelaufene Protokolle und Reset-Links", async () => {
    const db = getDb();
    const now = new Date("2026-10-03T00:00:00Z");
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
    const { user } = await makeDriver();
    for (const [id, age] of [["alt", 400], ["neu", 10]] as const) {
      await db.systemEvents.insert({ id: `${id}-event-${newId()}`.slice(0, 36), level: "info", source: "test", message: id, context: null, createdAt: daysAgo(age) });
      await db.passwordResets.insert({ id: newId(), userId: user.id, tokenHash: `${id}-${newId()}`, expiresAt: daysAgo(age), usedAt: null, createdAt: daysAgo(age === 400 ? 40 : 5) });
    }
    expect(await applyRetention(now)).toEqual({ systemEvents: 1, passwordResets: 1 });
    expect((await db.systemEvents.findMany()).map((e) => e.message)).toEqual(["neu"]);
    expect(await db.passwordResets.count()).toBe(1);
    expect(await applyRetention(now)).toEqual({ systemEvents: 0, passwordResets: 0 });
  });

  it("Cron-Endpunkt läuft ohne Secret und verlangt es, sobald eines gesetzt ist", async () => {
    const call = (auth?: string) => retentionCron(new Request("http://localhost/api/cron/aufbewahrung", {
      headers: { "x-forwarded-for": nextIp(), ...(auth ? { authorization: auth } : {}) },
    }), { params: Promise.resolve({}) });
    expect((await call()).status).toBe(200);
    vi.stubEnv("CRON_SECRET", "geheimer-cron-wert");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer geheimer-cron-wert")).status).toBe(200);
  });
});
