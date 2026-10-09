import { describe, expect, it, vi } from "vitest";
import { ApiError, callApi, deepLink, trustedBrowserUrl, validateApiBase, euro } from "../src/api";
describe("Native API and safe navigation", () => {
  it("release only accepts HTTPS LieferDank", () => { expect(validateApiBase("https://lieferdank.de")).toBe("https://lieferdank.de"); });
  it.each(["http://lieferdank.de", "https://lieferdank.de:444", "https://lieferdank.de.evil.invalid", "https://user:pw@lieferdank.de", "http://127.0.0.1:3100", "https://lieferdank.de/path", "https://lieferdank.de?token=bad"])("rejects release base %s", value => { expect(() => validateApiBase(value)).toThrow(); });
  it("allows explicit local testing separately", () => { expect(validateApiBase("http://127.0.0.1:3100", true)).toBe("http://127.0.0.1:3100"); });
  it("sends bearer only to a relative LieferDank API path", async () => { const f = vi.fn(async () => Response.json({ ok: true })); await callApi("https://lieferdank.de", "/api/v1/me", "token", {}, f); expect(f.mock.calls[0][0]).toBe("https://lieferdank.de/api/v1/me"); expect(f.mock.calls[0][1]?.headers).toMatchObject({ authorization: "Bearer token" }); });
  it.each(["https://evil.invalid/api/v1/me", "//evil.invalid", "/api/v1/../admin"])("never leaks bearer to %s", async path => { const f=vi.fn(); await expect(callApi("https://lieferdank.de",path,"secret",{},f)).rejects.toThrow(); expect(f).not.toHaveBeenCalled(); });
  it("preserves 401 for session invalidation", async () => { await expect(callApi("https://lieferdank.de", "/api/v1/me", "expired", {}, vi.fn(async()=>Response.json({error:{message:"Bitte anmelden"}},{status:401})))).rejects.toBeInstanceOf(ApiError); });
  it("network errors expose neither token nor provider internals", async () => { await expect(callApi("https://lieferdank.de", "/api/v1/me", "token", {}, vi.fn(async()=>{throw new Error("raw secret trace")}))).rejects.toThrow("Keine Verbindung zu LieferDank"); });
  it.each(["https://lieferdank.de.evil.invalid/app/stripe-return", "javascript:alert(1)", "https://evil.invalid/passwort-neu?token=abc", "https://user:pw@lieferdank.de/app/stripe-return"])("rejects malicious link %s", value=>expect(deepLink(value)).toBeNull());
  it("Stripe return opens status, never claims success",()=>expect(deepLink("lieferdank://stripe-return")).toEqual({screen:"stripe"}));
  it("universal Stripe return opens status",()=>expect(deepLink("https://lieferdank.de/app/stripe-return")).toEqual({screen:"stripe"}));
  it("strict reset token parsing",()=>{expect(deepLink("https://lieferdank.de/passwort-neu?token=bad")).toBeNull();expect(deepLink(`https://lieferdank.de/passwort-neu?token=${"A".repeat(43)}`)).toEqual({resetToken:"A".repeat(43)});});
  it.each(["http://connect.stripe.com/setup", "https://connect.stripe.com.evil.invalid/setup", "https://u:p@connect.stripe.com/setup"])("rejects browser target %s",value=>expect(trustedBrowserUrl(value)).toBe(false));
  it("permits hosted Connect and public QR URL",()=>{expect(trustedBrowserUrl("https://connect.stripe.com/setup/test")).toBe(true);expect(trustedBrowserUrl("https://lieferdank.de/danke/LD-TEST")).toBe(true);});
  it.each([[200,"2,00"],[240,"2,40"],[400,"4,00"],[0,"0,00"]])("displays integer cents %s",(cents,text)=>expect(euro(cents)).toContain(text));
});

import config from "../app.config";
it("fixes the public EAS identity to the LieferDank project", () => { expect(config.owner).toBe("attaafsari-code"); expect(config.slug).toBe("lieferdank-driver"); expect(config.extra?.eas?.projectId).toBe("85ed233e-4c12-47c0-8510-d550c8f8a467"); expect(config.ios?.bundleIdentifier).toBe("de.lieferdank.driver"); expect(config.android?.package).toBe("de.lieferdank.driver"); });

import { driverThankUrl } from "../src/api";
it("undeployed HTML login is a backend error, not a fabricated connectivity failure", async () => {
  await expect(callApi("https://lieferdank.de", "/api/v1/auth/mobile/login", null, {}, vi.fn(async () => new Response("<html>not found</html>", { status: 404 })))).rejects.toMatchObject({ status: 404, message: "Die App-Anbindung ist gerade nicht verfügbar. Bitte versuche es später erneut." });
});
it("opens the authenticated code on the canonical public host without trusting a returned redirect", () => {
  expect(driverThankUrl("LD-CFWZGEBJXL")).toBe("https://lieferdank.de/danke/LD-CFWZGEBJXL");
  expect(() => driverThankUrl("LD-TEST/../../admin")).toThrow();
  expect(() => driverThankUrl("LD-TEST", "https://attacker.invalid")).toThrow();
});

import { releasePreflight } from "../scripts/release-preflight.mjs";
it("blocks production native builds when login is missing or disabled", async () => {
  for (const response of [new Response("missing", { status: 404 }), Response.json({ error: { code: "app_unavailable" } }, { status: 503 })]) {
    const f = vi.fn().mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(response);
    await expect(releasePreflight(f)).rejects.toThrow("Native Production-API fehlt");
    expect(f.mock.calls[1][1].body).toBe("{}");
  }
});
it("allows release only with healthy production and functioning native input validation", async () => {
  const f = vi.fn().mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(Response.json({ error: { code: "invalid_input" } }, { status: 400 }));
  await expect(releasePreflight(f)).resolves.toBeUndefined();
  expect(f.mock.calls[1][0]).toBe("https://lieferdank.de/api/v1/auth/mobile/login");
});
