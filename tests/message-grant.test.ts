import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postThanks } from "@/app/api/v1/drivers/[code]/thanks/route";
import { POST as postTip } from "@/app/api/v1/drivers/[code]/tips/route";
import { POST as postMessage } from "@/app/api/v1/thanks/[id]/message/route";
import { getDb } from "@/lib/db";
import { attachMessageAction, sendThanksAction, startTipAction } from "@/server/actions/customer-flow";
import { MESSAGE_GRANT_COOKIE, signMessageGrant } from "@/server/message-grant";
import { attachMessage, confirmPayment, sendFreeThankYou } from "@/server/services/thanks";
import { purposeKey, signEmailVerificationToken, signSessionToken } from "@/server/session";
import { freshDb, makeDriver } from "./helpers";

/** Ein Cookie-Speicher pro „Browser“ – so lassen sich Absender und Fremde trennen. */
const browser = { jar: new Map<string, string>() };
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (browser.jar.has(name) ? { name, value: browser.jar.get(name)! } : undefined),
    set: (name: string, value: string) => { browser.jar.set(name, value); },
    delete: (name: string) => { browser.jar.delete(name); },
  }),
  headers: async () => new Headers({ "x-forwarded-for": `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` }),
}));

beforeEach(() => {
  freshDb();
  browser.jar = new Map();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

let ip = 0;
const params = <T>(value: T) => ({ params: Promise.resolve(value) });
function request(path: string, body?: unknown) {
  ip += 1;
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${Math.floor(ip / 250)}.${ip % 250}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const sendMessage = (id: string, body: Record<string, unknown>) => postMessage(request(`/api/v1/thanks/${id}/message`, body), params({ id }));
const stored = async (id: string) => {
  const thankYou = await getDb().thankYous.get(id);
  return { presetId: thankYou?.presetId ?? null, message: thankYou?.message ?? null };
};

/** Server Actions leiten am Ende um – das ist hier der Erfolgsfall. */
async function redirected(action: Promise<unknown>) {
  await expect(action).rejects.toThrow(/NEXT_REDIRECT/);
}

describe("Nachricht zum Danke im Web", () => {
  it("nur der Browser, der Danke gesagt hat, darf schreiben – einmal", async () => {
    const { driver } = await makeDriver();
    const owner = browser.jar;
    await redirected(sendThanksAction(driver.code));
    const thankYou = (await getDb().thankYous.findOne({ driverId: driver.id }))!;

    // Fremder Browser mit bekannter ID: abgewiesen, nichts geschrieben.
    browser.jar = new Map();
    expect(await attachMessageAction(thankYou.id, "hochtragen", null)).toMatchObject({ ok: false });
    expect(await stored(thankYou.id)).toEqual({ presetId: null, message: null });

    browser.jar = owner;
    expect(await attachMessageAction(thankYou.id, "hochtragen", null)).toEqual({ ok: true });
    // Wiederholung überschreibt nicht.
    expect(await attachMessageAction(thankYou.id, null, "Anders überlegt")).toEqual({ ok: true });
    expect(await stored(thankYou.id)).toEqual({ presetId: "hochtragen", message: null });
  });

  it("nach einem Trinkgeld schreibt nur der zahlende Browser", async () => {
    const { driver } = await makeDriver();
    await redirected(startTipAction(driver.code, 300));
    const owner = browser.jar;
    const tip = (await getDb().tips.findOne({ driverId: driver.id }))!;
    await confirmPayment(tip.paymentId);
    const thankYou = (await getDb().thankYous.findOne({ tipId: tip.id }))!;

    browser.jar = new Map();
    expect(await attachMessageAction(thankYou.id, null, "Fremd")).toMatchObject({ ok: false });
    browser.jar = owner;
    expect(await attachMessageAction(thankYou.id, null, "Danke fürs Hochtragen!")).toEqual({ ok: true });
    expect(await stored(thankYou.id)).toEqual({ presetId: null, message: "Danke fürs Hochtragen!" });
  });

  it("hält die letzten fünf Vorgänge eines Browsers", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const { driver } = await makeDriver();
      await redirected(sendThanksAction(driver.code));
      ids.push((await getDb().thankYous.findOne({ driverId: driver.id }))!.id);
    }
    expect(await attachMessageAction(ids[0], "wetter", null)).toMatchObject({ ok: false });
    expect(await attachMessageAction(ids[5], "wetter", null)).toEqual({ ok: true });
    expect(await attachMessageAction(ids[1], "wetter", null)).toEqual({ ok: true });
    expect(browser.jar.get(MESSAGE_GRANT_COOKIE)).toBeTruthy();
  });
});

describe("Nachricht zum Danke in der App-API", () => {
  it("gibt nach dem Trinkgeldstart nur dem Initiator ein Nachrichtentoken für diese Zahlung", async () => {
    const { driver } = await makeDriver();
    const response = await postTip(request(`/api/v1/drivers/${driver.code}/tips`, { amountCents: 300 }), params({ code: driver.code }));
    expect(response.status).toBe(200);
    const { paymentId, messageToken } = await response.json() as { paymentId: string; messageToken: string };
    expect(messageToken).toEqual(expect.any(String));
    await confirmPayment(paymentId);
    const thankYou = (await getDb().thankYous.findOne({ driverId: driver.id, tipId: (await getDb().tips.findOne({ paymentId }))!.id }))!;
    expect((await sendMessage(thankYou.id, { message: "Nicht meins", messageToken: await signMessageGrant([`p:${crypto.randomUUID()}`]) })).status).toBe(404);
    expect((await sendMessage(thankYou.id, { message: "Danke!", messageToken })).status).toBe(200);
    expect(await stored(thankYou.id)).toEqual({ presetId: null, message: "Danke!" });
  });

  async function freeThanks() {
    const { driver } = await makeDriver();
    const response = await postThanks(request(`/api/v1/drivers/${driver.code}/thanks`), params({ code: driver.code }));
    const body = await response.json();
    expect(body.messageToken).toEqual(expect.any(String));
    return body as { thankYouId: string; messageToken: string };
  }

  it("verlangt das Token des Absenders und schreibt nur einmal", async () => {
    const own = await freeThanks();
    const other = await freeThanks();
    expect((await sendMessage(own.thankYouId, { presetId: "hochtragen" })).status).toBe(400);
    expect((await sendMessage(own.thankYouId, { presetId: "hochtragen", messageToken: other.messageToken })).status).toBe(404);
    expect((await sendMessage(own.thankYouId, { presetId: "hochtragen", messageToken: "kaputt" })).status).toBe(404);
    expect(await stored(own.thankYouId)).toEqual({ presetId: null, message: null });

    expect((await sendMessage(own.thankYouId, { presetId: "hochtragen", messageToken: own.messageToken })).status).toBe(200);
    expect((await sendMessage(own.thankYouId, { message: "Nachträglich", messageToken: own.messageToken })).status).toBe(200);
    expect(await stored(own.thankYouId)).toEqual({ presetId: "hochtragen", message: null });
  });

  it("akzeptiert keine Tokens anderer Zwecke und keine abgelaufenen", async () => {
    const own = await freeThanks();
    const user = (await getDb().users.findOne({ role: "driver" }))!;
    const devKey = new TextEncoder().encode("lieferdank-dev-secret-nur-lokal-nicht-produktiv");
    const sameClaimsWrongKey = await new SignJWT({ typ: "thank_you_message", subs: [`t:${own.thankYouId}`] })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(devKey);
    // Richtiger Schlüssel, aber ohne Zweckangabe: ebenfalls kein Schreibrecht.
    const withoutPurpose = await new SignJWT({ subs: [`t:${own.thankYouId}`] })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(purposeKey("thank_you_message"));
    for (const token of [await signSessionToken(user), await signEmailVerificationToken(user), sameClaimsWrongKey, withoutPurpose]) {
      expect((await sendMessage(own.thankYouId, { presetId: "wetter", messageToken: token })).status).toBe(404);
    }
    vi.useFakeTimers({ now: Date.now() + 25 * 60 * 60_000, toFake: ["Date"] });
    expect((await sendMessage(own.thankYouId, { presetId: "wetter", messageToken: own.messageToken })).status).toBe(404);
    vi.useRealTimers();
    expect(await stored(own.thankYouId)).toEqual({ presetId: null, message: null });
  });

  it("gleichzeitige Nachrichten: genau eine gewinnt, keine überschreibt", async () => {
    const own = await freeThanks();
    const texts = ["Erste", "Zweite", "Dritte", "Vierte", "Fünfte"];
    const statuses = await Promise.all(texts.map((message) => sendMessage(own.thankYouId, { message, messageToken: own.messageToken })
      .then((response) => response.status)));
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    const { message } = await stored(own.thankYouId);
    expect(texts).toContain(message);
    // Danach ändert auch kein weiterer Versuch etwas.
    await sendMessage(own.thankYouId, { message: "Später", messageToken: own.messageToken });
    expect((await stored(own.thankYouId)).message).toBe(message);
  });
});

describe("Dienst", () => {
  it("schreibt bei gleichzeitigem Zugriff mit gleichem Lesestand nur den ersten Wert", async () => {
    const { driver } = await makeDriver();
    const { thankYouId } = await sendFreeThankYou(driver.code, null, "b".repeat(32));
    const grants = [`t:${thankYouId}`];
    await Promise.all([
      attachMessage(thankYouId, "hochtragen", null, grants),
      attachMessage(thankYouId, null, "Überschreiben?", grants),
    ]);
    expect(await stored(thankYouId)).toEqual({ presetId: "hochtragen", message: null });
  });

  it("ein Zahlungs-Schreibrecht gilt nur für das Danke genau dieser Zahlung", async () => {
    const { driver } = await makeDriver();
    const { thankYouId } = await sendFreeThankYou(driver.code, null, "c".repeat(32));
    await expect(attachMessage(thankYouId, "wetter", null, [`p:${crypto.randomUUID()}`])).rejects.toMatchObject({ status: 404 });
    await expect(attachMessage(crypto.randomUUID(), "wetter", null, [`t:${thankYouId}`])).rejects.toMatchObject({ status: 404 });
    expect(await signMessageGrant([])).toEqual(expect.any(String));
  });
});
