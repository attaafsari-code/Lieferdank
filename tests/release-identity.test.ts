import { beforeEach, expect, it, vi } from "vitest";
import { freshDb, makeCustomer, makeDriver } from "./helpers";
import { getDb } from "@/lib/db";
import { registerCustomer } from "@/server/services/auth";
import { enableDriver } from "@/server/services/roles";
import { getBearerSession, signSessionToken } from "@/server/session";
import { addFavoriteByCode } from "@/server/services/favorites";
import { sendFreeThankYou, startTip } from "@/server/services/thanks";
import { POST as publicThanks } from "@/app/api/v1/drivers/[code]/thanks/route";
import { POST as activate } from "@/app/api/v1/me/driver/route";
import { GET as favorites } from "@/app/api/v1/me/favorites/route";
import { deleteAccount } from "@/server/services/profile";

beforeEach(() => { freshDb(); vi.restoreAllMocks(); vi.spyOn(console, "info").mockImplementation(() => undefined); });
it("one identity survives concurrent customer-to-driver activation, including favorites and old sessions", async () => {
  const customer = await makeCustomer(); const other = await makeDriver();
  const favorite = await addFavoriteByCode(customer.id, other.driver.code);
  const token = await signSessionToken(customer);
  const input = { firstName: "Lena", lastName: "Test", acceptedTerms: true };
  const results = await Promise.all([enableDriver(customer, input), enableDriver(customer, input)]);
  expect(results[0].id).toBe(results[1].id);
  expect(await getDb().driverProfiles.count({ where: { userId: customer.id } })).toBe(1);
  expect((await getDb().users.get(customer.id))?.email).toBe(customer.email);
  expect(await getDb().customerProfiles.findOne({ userId: customer.id })).toBeTruthy();
  expect(await getDb().driverFavorites.get(favorite.id)).toBeTruthy();
  const session = await getBearerSession(new Request("https://lieferdank.de/api/v1/me", { headers: { authorization: `Bearer ${token}` } }));
  expect(session?.driver).toBeTruthy(); expect(session?.customer).toBeTruthy();
});
it("admin and unaccepted activation cannot acquire a driver profile", async () => {
  const c = await makeCustomer();
  await expect(enableDriver(c, { firstName: "A", lastName: "B", acceptedTerms: false })).rejects.toMatchObject({ code: "invalid_input" });
  await expect(enableDriver({ ...c, role: "admin" }, { firstName: "A", lastName: "B", acceptedTerms: true })).rejects.toMatchObject({ code: "forbidden" });
  expect(await getDb().driverProfiles.count()).toBe(0);
});
it("normalizes and rejects simultaneous email duplicates without merging identities", async () => {
  const input = { firstName: "Test", email: "  Concurrent@Test.de ", password: "sicheres-passwort", terms: "on" as const };
  const results = await Promise.allSettled([registerCustomer(input), registerCustomer(input)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "email_taken" });
  expect(await getDb().users.count()).toBe(1);
  expect((await getDb().users.findMany())[0].email).toBe("concurrent@test.de");
});
it("rejects a driver's own free thanks before counting or milestones; anonymous daily dedup remains", async () => {
  const { user, driver } = await makeDriver();
  await expect(sendFreeThankYou(driver.code, null, "owner-browser", new Date(), user.id)).rejects.toMatchObject({ code: "self_thanks" });
  expect(await getDb().thankYous.count()).toBe(0);
  const results = await Promise.all([sendFreeThankYou(driver.code, null, "a".repeat(32)), sendFreeThankYou(driver.code, null, "a".repeat(32))]);
  expect(results[0].thankYouId).toBe(results[1].thankYouId);
  expect(await getDb().thankYous.count()).toBe(1);
});
it("public API cannot bypass the owner check by omitting bearer and keeping the web cookie", async () => {
  const { user, driver } = await makeDriver();
  const token = await signSessionToken(user);
  const r = await publicThanks(new Request("https://lieferdank.de/api/v1/drivers/x/thanks", { method: "POST", headers: { cookie: `ld_session=${token}` } }), { params: Promise.resolve({ code: driver.code }) });
  expect(r.status).toBe(403); expect((await r.json()).error.code).toBe("self_thanks");
  expect(await getDb().thankYous.count()).toBe(0);
});
it("activation ignores forged identity/role and keeps favorites usable with the original session", async () => {
  const a = await makeCustomer(), b = await makeCustomer(); const d = await makeDriver();
  await addFavoriteByCode(a.id, d.driver.code); const token = await signSessionToken(a);
  const request = new Request("https://lieferdank.de/api/v1/me/driver", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ firstName: "Lena", lastName: "Test", acceptedTerms: true, userId: b.id, role: "admin" }) });
  expect((await activate(request, { params: Promise.resolve({}) })).status).toBe(200);
  expect((await getDb().users.get(a.id))?.role).toBe("driver");
  expect(await getDb().driverProfiles.findOne({ userId: b.id })).toBeNull();
  const response = await favorites(new Request("https://lieferdank.de/api/v1/me/favorites", { headers: { authorization: `Bearer ${token}` } }), { params: Promise.resolve({}) });
  expect(response.status).toBe(200); expect((await response.json()).favorites).toHaveLength(1);
});
it("a promoted customer cannot self-tip and account deletion also removes customer favorites", async () => {
  const a = await makeCustomer(), d = await makeDriver();
  await addFavoriteByCode(a.id, d.driver.code);
  const driver = await enableDriver(a, { firstName: "A", lastName: "Test", acceptedTerms: true });
  await expect(startTip(driver.code, 300, a.id, a.id)).rejects.toMatchObject({ code: "self_thanks" });
  expect(await getDb().payments.count()).toBe(0);
  await deleteAccount((await getDb().users.get(a.id))!);
  expect(await getDb().driverFavorites.count({ where: { customerId: a.id } })).toBe(0);
  expect((await getDb().driverProfiles.get(driver.id))?.active).toBe(false);
});
