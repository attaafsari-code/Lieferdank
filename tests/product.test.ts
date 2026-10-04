import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { REMOVED_MESSAGE_ID } from "@/lib/messages";
import { regenerateCode, reviewBadge, setUserBlocked } from "@/server/services/admin";
import { getDriverStats } from "@/server/services/stats";
import { attachMessage, removeMessage, sendFreeThankYou } from "@/server/services/thanks";
import { freshDb, makeCustomer, makeDriver } from "./helpers";

type Mail = { to: string; subject: string; text: string };
let mails: Mail[] = [];

beforeEach(() => {
  freshDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.stubEnv("RESEND_API_KEY", "local-test-token");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    mails.push({ to: body.to[0], subject: body.subject, text: body.text });
    return new Response("{}", { status: 200 });
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function makeAdmin() {
  const { user } = await makeDriver({ firstName: "Ada" });
  await getDb().users.update(user.id, { role: "admin" });
  return (await getDb().users.get(user.id))!;
}

describe("Nachricht entfernen", () => {
  it("entfernt nur den Text, lässt das Danke gezählt und sperrt das Nachschieben", async () => {
    const { driver } = await makeDriver();
    const { thankYouId } = await sendFreeThankYou(driver.code, null, "a".repeat(32));
    await attachMessage(thankYouId, null, "Unpassender Text", [`t:${thankYouId}`]);
    expect((await getDb().thankYous.get(thankYouId))?.message).toBe("Unpassender Text");

    await removeMessage(driver.id, thankYouId);
    const removed = (await getDb().thankYous.get(thankYouId))!;
    expect(removed.message).toBeNull();
    expect(removed.presetId).toBe(REMOVED_MESSAGE_ID);
    expect((await getDriverStats(driver.id)).total.thanks).toBe(1);

    // Der Absender hält sein Schreibrecht noch – eine neue Nachricht darf trotzdem nicht ankommen.
    await attachMessage(thankYouId, null, "Zweiter Versuch", [`t:${thankYouId}`]);
    await attachMessage(thankYouId, "paket", null, [`t:${thankYouId}`]);
    const after = (await getDb().thankYous.get(thankYouId))!;
    expect(after.message).toBeNull();
    expect(after.presetId).toBe(REMOVED_MESSAGE_ID);
  });

  it("lässt nur den Empfänger entfernen", async () => {
    const owner = await makeDriver();
    const other = await makeDriver();
    const { thankYouId } = await sendFreeThankYou(owner.driver.code, null, "b".repeat(32));
    await attachMessage(thankYouId, null, "Für den Empfänger", [`t:${thankYouId}`]);

    await expect(removeMessage(other.driver.id, thankYouId)).rejects.toThrow(/nicht gefunden/);
    await expect(removeMessage(owner.driver.id, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(/nicht gefunden/);
    expect((await getDb().thankYous.get(thankYouId))?.message).toBe("Für den Empfänger");
  });
});

describe("Adminentscheidungen erreichen die betroffene Person", () => {
  it("begründet eine Kontosperre per E-Mail – genau einmal", async () => {
    const admin = await makeAdmin();
    const { user } = await makeDriver();
    mails = [];

    await setUserBlocked(admin, user.id, true, "Beleidigendes Profilfoto");
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe(user.email);
    expect(mails[0].subject).toMatch(/gesperrt/);
    expect(mails[0].text).toContain("Grund: Beleidigendes Profilfoto");
    expect(mails[0].text).toMatch(/erneute Prüfung/);
    expect(mails[0].text).toContain("/kontakt");

    await setUserBlocked(admin, user.id, true, "Nochmals gesperrt");
    await setUserBlocked(admin, user.id, false, "");
    expect(mails).toHaveLength(1);
  });

  it("teilt einen ersetzten Danke-Code mit", async () => {
    const admin = await makeAdmin();
    const { user, driver } = await makeDriver();
    mails = [];

    const code = await regenerateCode(admin, driver.id, "Karte gestohlen");
    expect(code).not.toBe(driver.code);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe(user.email);
    expect(mails[0].text).toContain(code);
    expect(mails[0].text).toContain("Grund: Karte gestohlen");
    expect(mails[0].text).not.toContain(driver.code);
  });

  it("teilt die Entscheidung über das Abzeichen mit", async () => {
    const admin = await makeAdmin();
    const { user, driver } = await makeDriver();
    mails = [];

    await reviewBadge(admin, driver.id, "rejected", "Bitte Stadt und Dienst nennen");
    await reviewBadge(admin, driver.id, "verified", "");
    expect(mails.map((mail) => mail.to)).toEqual([user.email, user.email]);
    expect(mails[0].text).toContain("Anmerkung: Bitte Stadt und Dienst nennen");
    expect(mails[1].subject).toMatch(/Abzeichen ist da/);
  });

  it("lässt die Adminaktion gelten, auch wenn die Mail nicht zugestellt wird", async () => {
    const admin = await makeAdmin();
    const { user } = await makeDriver();
    await makeCustomer();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await setUserBlocked(admin, user.id, true, "Betrugsverdacht");
    expect((await getDb().users.get(user.id))?.blockedAt).toBeTruthy();
    const warnings = await getDb().systemEvents.findMany({ where: { source: "admin" } });
    expect(warnings.some((event) => event.message.includes("nicht per E-Mail informiert"))).toBe(true);
  });
});
