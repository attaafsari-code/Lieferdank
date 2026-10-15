import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, makeCustomer } from "./helpers";
import { getDb } from "@/lib/db";
import { confirmNewsletter, newsletterStatus, requestNewsletter, revokeNewsletter, revokeNewsletterLink } from "@/server/services/newsletter";
import { POST as subscribe } from "@/app/api/v1/me/newsletter/route";
import { mobileLogin } from "@/server/services/mobile";

beforeEach(() => { freshDb(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.spyOn(console, "info").mockImplementation(() => undefined); });
afterEach(() => vi.useRealTimers());

function linkToken(): string {
  const call = vi.mocked(globalThis.fetch).mock.calls.at(-1);
  const body = JSON.parse(String(call?.[1]?.body));
  return /token=([^"&\s]+)/.exec(body.text)![1];
}

describe("Newsletter double opt-in", () => {
  it("withdrawal wins a concurrent confirmation or explicitly reports a conflict", async () => {
    const user = await makeCustomer(); await requestNewsletter(user, "app");
    const table = getDb().marketingConsents; const update = table.updateIf.bind(table);
    vi.spyOn(table, "updateIf").mockImplementationOnce(async (id) => { await table.update(id, { status: "confirmed" }); return false; });
    await revokeNewsletter(user); expect((await newsletterStatus(user)).status).toBe("revoked");
    const row = (await table.findOne({ userId: user.id }))!;
    await table.update(row.id, { status: "pending" });
    vi.mocked(table.updateIf).mockImplementation(async () => false);
    await expect(revokeNewsletter(user)).rejects.toMatchObject({ code: "newsletter_conflict" });
    vi.mocked(table.updateIf).mockImplementation(update);
  });
  it("supports signed unsubscribe without login, repeats and a fresh double opt-in", async () => {
    const user = await makeCustomer(); vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ id: "mail" }));
    await requestNewsletter(user, "app");
    const body = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls.at(-1)?.[1]?.body));
    const cancel = /newsletter-abmelden\?token=([^"&\s]+)/.exec(body.text)![1];
    await expect(confirmNewsletter(cancel)).rejects.toMatchObject({ code: "newsletter_link_invalid" });
    await confirmNewsletter(linkToken());
    await revokeNewsletterLink(cancel); await revokeNewsletterLink(cancel);
    expect((await newsletterStatus(user)).status).toBe("revoked");
    await requestNewsletter(user, "web");
    await expect(revokeNewsletterLink(cancel)).rejects.toMatchObject({ code: "newsletter_link_invalid" });
    await confirmNewsletter(linkToken());
    expect((await newsletterStatus(user)).status).toBe("confirmed");
    expect(await getDb().marketingConsents.count({ where: { userId: user.id } })).toBe(1);
  });
  it("does not confirm an expired token", async () => {
    const user = await makeCustomer(); vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ id: "mail" }));
    await requestNewsletter(user, "app"); const token = linkToken();
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + 8 * 86400000);
    await expect(confirmNewsletter(token)).rejects.toMatchObject({ code: "newsletter_link_invalid" });
    expect((await newsletterStatus(user)).status).toBe("pending");
  });
  it("defaults to voluntary signup without enabling a newsletter dispatch job", async () => {
    const user = await makeCustomer();
    expect(await newsletterStatus(user)).toEqual({ available: true, status: "none" });
  });
  it("is not offered while switched off, but withdrawal always works", async () => {
    vi.stubEnv("NEWSLETTER_ENABLED", "false");
    const user = await makeCustomer();
    await expect(requestNewsletter(user, "app")).rejects.toMatchObject({ code: "newsletter_unavailable" });
    expect(await newsletterStatus(user)).toEqual({ available: false, status: "none" });
    await expect(revokeNewsletter(user)).resolves.toBeUndefined();
  });
  it("only a click on the latest link confirms; revoke ends it", async () => {
    vi.stubEnv("NEWSLETTER_ENABLED", "true"); vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ id: "mail-1" }));
    const user = await makeCustomer();
    const first = await requestNewsletter(user, "app");
    expect(first).toEqual({ status: "pending", mailSent: true });
    const oldToken = linkToken();
    await new Promise((r) => setTimeout(r, 5));
    await requestNewsletter(user, "app");
    await expect(confirmNewsletter(oldToken)).rejects.toMatchObject({ code: "newsletter_link_invalid" });
    await confirmNewsletter(linkToken());
    expect((await newsletterStatus(user)).status).toBe("confirmed");
    await revokeNewsletter(user);
    expect((await getDb().marketingConsents.findOne({ userId: user.id }))?.status).toBe("revoked");
  });
  it("keeps a mail failure pending and never records false consent confirmation", async () => {
    const user = await makeCustomer();
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("unavailable", { status: 503 }));
    expect(await requestNewsletter(user, "app")).toEqual({ status: "pending", mailSent: false });
    expect((await getDb().marketingConsents.findOne({ userId: user.id }))?.confirmedAt).toBeNull();
  });
  it("rejects a confirmation after unsubscribe and malformed or wrong-purpose links", async () => {
    const user = await makeCustomer(); vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ id: "mail" }));
    await requestNewsletter(user, "web"); const token = linkToken(); await revokeNewsletter(user);
    await expect(confirmNewsletter(token)).rejects.toMatchObject({ code: "newsletter_link_invalid" });
    await expect(confirmNewsletter("not-a-token")).rejects.toMatchObject({ code: "newsletter_link_invalid" });
    expect((await newsletterStatus(user)).status).toBe("revoked");
  });
  it("concurrent requests create exactly one consent row", async () => {
    const user = await makeCustomer();
    const results = await Promise.allSettled([requestNewsletter(user, "app"), requestNewsletter(user, "web")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await getDb().marketingConsents.count({ where: { userId: user.id } })).toBe(1);
  });
  it("API requires an explicit opt-in from the authenticated owner", async () => {
    const user = await makeCustomer(); const { token } = await mobileLogin({ email: user.email, password: "sicheres-passwort" });
    const r = await subscribe(new Request("https://lieferdank.de/api/v1/me/newsletter", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" }), { params: Promise.resolve({}) });
    expect(r.status).toBe(400); expect(await getDb().marketingConsents.count()).toBe(0);
  });
});
