import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, makeCustomer } from "./helpers";
import { getDb } from "@/lib/db";
import { confirmNewsletter, newsletterStatus, requestNewsletter, revokeNewsletter } from "@/server/services/newsletter";

beforeEach(() => { freshDb(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.spyOn(console, "info").mockImplementation(() => undefined); });

function linkToken(): string {
  const call = vi.mocked(globalThis.fetch).mock.calls.at(-1);
  const body = JSON.parse(String(call?.[1]?.body));
  return /token=([^"&\s]+)/.exec(body.text)![1];
}

describe("Newsletter double opt-in", () => {
  it("is not offered while switched off, but withdrawal always works", async () => {
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
});
