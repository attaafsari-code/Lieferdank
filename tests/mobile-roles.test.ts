import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, makeCustomer, makeDriver } from "./helpers";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { getBearerSession, hashPassword } from "@/server/session";
import { mobileLogin, mobileRegister } from "@/server/services/mobile";
import { GET as meRoute } from "@/app/api/v1/me/route";
import { GET as historyRoute } from "@/app/api/v1/me/history/route";
import { GET as statsRoute } from "@/app/api/v1/me/stats/route";
import { POST as deleteRoute } from "@/app/api/v1/me/delete/route";
import { POST as logoutRoute } from "@/app/api/v1/me/logout/route";

const PASSWORD = "Rollen-Test-2026";
let ip = 0;
const ctx = { params: Promise.resolve({}) };
function req(path: string, token?: string, body?: unknown, method = "GET") {
  return new Request(`http://localhost${path}`, { method, headers: { "x-forwarded-for": `10.77.${Math.floor(++ip / 200)}.${ip % 200}`, ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function withPassword(userId: string) { await getDb().users.update(userId, { passwordHash: await hashPassword(PASSWORD) }); }
async function makeAdmin() {
  return getDb().users.insert({ id: newId(), email: "admin-rolle@test.de", firstName: "Ada", lastName: "Admin", phone: null, role: "admin", passwordHash: await hashPassword(PASSWORD), tokenVersion: 0, createdAt: new Date().toISOString(), emailVerifiedAt: new Date().toISOString(), blockedAt: null, blockedReason: null });
}
beforeEach(() => { freshDb(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.stubEnv("DRIVER_APP_ENABLED", "true"); vi.stubEnv("PUSH_ENABLED", "true"); vi.spyOn(console, "info").mockImplementation(() => undefined); });

describe("Existing web accounts of every role can sign in natively", () => {
  it("customer gets a device session, own history, and no driver data", async () => {
    const customer = await makeCustomer(); await withPassword(customer.id);
    const session = await mobileLogin({ email: customer.email, password: PASSWORD });
    expect(session.role).toBe("customer");
    const me = await (await meRoute(req("/api/v1/me", session.token), ctx)).json();
    expect(me.user.role).toBe("customer"); expect(me.driver).toBeNull();
    expect((await historyRoute(req("/api/v1/me/history", session.token), ctx)).status).toBe(200);
    expect((await statsRoute(req("/api/v1/me/stats", session.token), ctx)).status).toBe(403);
  });
  it("admin signs in natively with a revocable device session", async () => {
    const admin = await makeAdmin();
    const session = await mobileLogin({ email: admin.email, password: PASSWORD });
    expect(session.role).toBe("admin");
    const me = await (await meRoute(req("/api/v1/me", session.token), ctx)).json();
    expect(me.user.role).toBe("admin"); expect(me.driver).toBeNull();
  });
  it("admin cannot delete the account from the app, but can log out", async () => {
    const admin = await makeAdmin();
    const { token } = await mobileLogin({ email: admin.email, password: PASSWORD });
    expect((await deleteRoute(req("/api/v1/me/delete", token, { password: PASSWORD }, "POST"), ctx)).status).toBe(403);
    expect((await getDb().users.get(admin.id))?.blockedAt).toBeNull();
    expect((await logoutRoute(req("/api/v1/me/logout", token, undefined, "POST"), ctx)).status).toBe(200);
    expect(await getBearerSession(req("/", token))).toBeNull();
  });
  it("e-mail case and surrounding spaces do not matter, the password does", async () => {
    const { user } = await makeDriver(); await withPassword(user.id);
    await expect(mobileLogin({ email: `  ${user.email.toUpperCase()} `, password: PASSWORD })).resolves.toHaveProperty("role", "driver");
    await expect(mobileLogin({ email: user.email, password: PASSWORD.charAt(0).toLowerCase() + PASSWORD.slice(1) })).rejects.toMatchObject({ code: "invalid_credentials" });
  });
  it("blocked accounts are refused without a session", async () => {
    const { user } = await makeDriver(); await withPassword(user.id);
    await getDb().users.update(user.id, { blockedAt: new Date().toISOString() });
    await expect(mobileLogin({ email: user.email, password: PASSWORD })).rejects.toMatchObject({ code: "blocked" });
    expect(await getDb().mobileSessions.count()).toBe(0);
  });
});

describe("Native registration", () => {
  it("registers a customer when asked, never an admin", async () => {
    const customer = await mobileRegister({ role: "customer", firstName: "Kim", email: "kim-app@test.de", password: PASSWORD, acceptedTerms: true });
    expect(customer.role).toBe("customer");
    const forged = await mobileRegister({ role: "admin", firstName: "Eve", lastName: "Test", email: "eve-app@test.de", password: PASSWORD, acceptedTerms: true });
    expect(forged.role).toBe("driver");
    expect(await getDb().users.count({ where: { role: "admin" } })).toBe(0);
    expect(await getDb().customerProfiles.count()).toBe(1);
  });
  it("requires accepted terms for customers too", async () => {
    await expect(mobileRegister({ role: "customer", email: "noterms@test.de", password: PASSWORD, acceptedTerms: false })).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("Milestone pushes", () => {
  it("a reached 100× milestone is pushed exactly once per device", async () => {
    const { registerPush, collectPushEvents } = await import("@/server/services/push");
    const { user, driver } = await makeDriver(); await withPassword(user.id);
    const { token } = await mobileLogin({ email: user.email, password: PASSWORD });
    const session = (await getBearerSession(req("/", token)))!;
    await registerPush(session, { token: "ExpoPushToken[milestoneDevice]", enabled: true });
    await getDb().milestones.insert({ id: newId(), driverId: driver.id, type: "thank_you_count", value: 100, achievedAt: new Date(Date.now() + 1000).toISOString() });
    await getDb().milestones.insert({ id: newId(), driverId: driver.id, type: "thank_you_count", value: 10, achievedAt: new Date(Date.now() + 1000).toISOString() });
    await collectPushEvents(); await collectPushEvents();
    const rows = await getDb().pushDeliveries.findMany();
    expect(rows).toHaveLength(1); expect(rows[0].body).toContain("100× Danke");
  });
});

describe("PUSH_ENABLED", () => {
  it("without PUSH_ENABLED the app is told push is unavailable and cannot register a token", async () => {
    vi.stubEnv("PUSH_ENABLED", "");
    const { GET } = await import("@/app/api/v1/me/push/route");
    const { registerPush } = await import("@/server/services/push");
    const { user } = await makeDriver(); await withPassword(user.id);
    const { token } = await mobileLogin({ email: user.email, password: PASSWORD });
    expect(await (await GET(req("/api/v1/me/push", token), ctx)).json()).toEqual({ available: false, enabled: false });
    const session = (await getBearerSession(req("/", token)))!;
    await expect(registerPush(session, { token: "ExpoPushToken[offDevice]", enabled: true })).rejects.toMatchObject({ code: "push_unavailable" });
    expect((await getDb().mobileSessions.get(session.mobileSessionId!))?.pushToken).toBeNull();
  });
  it("a stored opt-in is not shown as active once push is switched off", async () => {
    const { GET } = await import("@/app/api/v1/me/push/route");
    const { registerPush } = await import("@/server/services/push");
    const { user } = await makeDriver(); await withPassword(user.id);
    const { token } = await mobileLogin({ email: user.email, password: PASSWORD });
    await registerPush((await getBearerSession(req("/", token)))!, { token: "ExpoPushToken[onDevice]", enabled: true });
    expect((await (await GET(req("/api/v1/me/push", token), ctx)).json()).enabled).toBe(true);
    vi.stubEnv("PUSH_ENABLED", "false");
    expect(await (await GET(req("/api/v1/me/push", token), ctx)).json()).toEqual({ available: false, enabled: false });
  });
});

describe("Registration reports whether the welcome mail went out", () => {
  it("tells the new account owner when no mail could be sent", async () => {
    const result = await mobileRegister({ role: "customer", email: "nomail@test.de", password: PASSWORD, acceptedTerms: true });
    expect(result).toHaveProperty("mailSent", false);
  });
});
