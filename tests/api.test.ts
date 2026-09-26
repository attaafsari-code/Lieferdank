import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getDriver } from "@/app/api/v1/drivers/[code]/route";
import { POST as postThanks } from "@/app/api/v1/drivers/[code]/thanks/route";
import { POST as postTip } from "@/app/api/v1/drivers/[code]/tips/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { GET as me } from "@/app/api/v1/me/route";
import { GET as myStats } from "@/app/api/v1/me/stats/route";
import { GET as favorites } from "@/app/api/v1/me/favorites/route";
import { freshDb, makeCustomer, makeDriver } from "./helpers";

let ip = 0;
function request(path: string, init: RequestInit & { token?: string } = {}) {
  ip += 1; // eigene IP je Anfrage, damit das Rate Limit die Tests nicht stört
  const headers = new Headers(init.headers);
  headers.set("x-forwarded-for", `10.0.${Math.floor(ip / 250)}.${ip % 250}`);
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.body) headers.set("content-type", "application/json");
  return new Request(`http://localhost${path}`, { ...init, headers });
}
const params = <T>(value: T) => ({ params: Promise.resolve(value) });

beforeEach(() => {
  freshDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("API v1 – öffentlich", () => {
  it("liefert das öffentliche Profil ohne private Daten", async () => {
    const { user, driver } = await makeDriver();
    const response = await getDriver(request(`/api/v1/drivers/${driver.code}`), params({ code: driver.code }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.driver.name).toBe("Max");
    expect(body.tipping.optionsCents).toEqual([200, 300, 500]);
    expect(JSON.stringify(body)).not.toContain(user.email);
  });

  it("antwortet mit 404 für unbekannte Codes", async () => {
    const response = await getDriver(request("/api/v1/drivers/LD-XXXXX"), params({ code: "LD-XXXXX" }));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });

  it("nimmt ein kostenloses Danke an", async () => {
    const { driver } = await makeDriver();
    const response = await postThanks(request(`/api/v1/drivers/${driver.code}/thanks`, { method: "POST" }), params({ code: driver.code }));
    expect(response.status).toBe(200);
    expect((await response.json()).thankYouId).toBeTruthy();
  });

  it("startet eine Zahlung und liefert die Checkout-URL", async () => {
    const { driver } = await makeDriver();
    const response = await postTip(
      request(`/api/v1/drivers/${driver.code}/tips`, { method: "POST", body: JSON.stringify({ amountCents: 300 }) }),
      params({ code: driver.code }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).checkoutUrl).toMatch(/^\/zahlung\//);
  });

  it("lehnt ungültige Beträge mit 400 ab", async () => {
    const { driver } = await makeDriver();
    const response = await postTip(
      request(`/api/v1/drivers/${driver.code}/tips`, { method: "POST", body: JSON.stringify({ amountCents: 100 }) }),
      params({ code: driver.code }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.field).toBe("amount");
  });
});

describe("API v1 – angemeldet", () => {
  it("verlangt ein Token", async () => {
    expect((await me(request("/api/v1/me"), params({}))).status).toBe(401);
  });

  it("ignoriert Cookies – nur Bearer-Tokens zählen (CSRF-Schutz)", async () => {
    const response = await me(request("/api/v1/me", { headers: { cookie: "ld_session=irgendwas" } }), params({}));
    expect(response.status).toBe(401);
  });

  it("meldet an und liefert Profil und Statistik – ohne Kundenbezug", async () => {
    const { user, driver } = await makeDriver();
    const customer = await makeCustomer();
    await postThanks(request(`/api/v1/drivers/${driver.code}/thanks`, { method: "POST" }), params({ code: driver.code }));
    const { sendFreeThankYou } = await import("@/server/services/thanks");
    await sendFreeThankYou(driver.code, customer.id);

    const loginResponse = await login(
      request("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: user.email, password: "sicheres-passwort" }) }),
      params({}),
    );
    expect(loginResponse.status).toBe(200);
    const { token } = await loginResponse.json();

    const profile = await (await me(request("/api/v1/me", { token }), params({}))).json();
    expect(profile.driver.code).toBe(driver.code);

    const stats = await (await myStats(request("/api/v1/me/stats", { token }), params({}))).json();
    expect(stats.total.thanks).toBe(2);
    expect(JSON.stringify(stats)).not.toContain(customer.id);
  });

  it("trennt Rollen: Lieferanten haben keine Favoriten", async () => {
    const { user } = await makeDriver();
    const { token } = await (
      await login(request("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: user.email, password: "sicheres-passwort" }) }), params({}))
    ).json();
    expect((await favorites(request("/api/v1/me/favorites", { token }), params({}))).status).toBe(403);
  });

  it("lehnt falsche Passwörter mit 401 ab", async () => {
    const { user } = await makeDriver();
    const response = await login(
      request("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: user.email, password: "falsch-falsch" }) }),
      params({}),
    );
    expect(response.status).toBe(401);
  });
});
