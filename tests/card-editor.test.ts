import { beforeEach, expect, it, vi } from "vitest";
import { freshDb, makeCustomer, makeDriver } from "./helpers";
import { getDb } from "@/lib/db";
import { mobileLogin } from "@/server/services/mobile";
import { GET, PATCH } from "@/app/api/v1/me/card/route";
import { GET as code } from "@/app/api/v1/me/code/route";
import { getCardDesign, renderDriverCard, saveCardDesign } from "@/server/services/cards";
import { CARD_COLORS, CARD_LAYOUTS } from "@/lib/card/design";
import { newId } from "@/lib/id";

const ctx = { params: Promise.resolve({}) }; let ip = 0;
function req(token?: string, body?: unknown) { return new Request("http://localhost/api/v1/me/card", { method: body === undefined ? "GET" : "PATCH", headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${++ip}`, ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
async function device() { const d = await makeDriver(); return { ...d, ...(await mobileLogin({ email: d.user.email, password: "sicheres-passwort" })) }; }
beforeEach(() => { freshDb(); vi.restoreAllMocks(); vi.stubEnv("DRIVER_APP_ENABLED", "true"); vi.spyOn(console, "info").mockImplementation(() => undefined); });

it("requires a driver bearer session and returns only owner editor fields", async () => {
  expect((await GET(req(), ctx)).status).toBe(401);
  const customer = await makeCustomer(); const login = await mobileLogin({ email: customer.email, password: "sicheres-passwort" });
  expect((await GET(req(login.token), ctx)).status).toBe(403);
  const a = await device(); const res = await GET(req(a.token), ctx); const data = await res.json();
  expect(res.headers.get("cache-control")).toBe("no-store"); expect(data.context.code).toBe(a.driver.code);
  expect(data.design.color).toBe("blue"); expect(JSON.stringify(data)).not.toContain(a.user.email);
  expect(Object.keys(data.design).sort()).toEqual(["color", "headline", "layout", "showPhoto", "showProvider", "showRankBadge", "updatedAt"].sort());
});

it("persists every layout/color to the same design used by web print and existing native PDF", async () => {
  const a = await device(); let { design } = await (await GET(req(a.token), ctx)).json();
  for (const layout of CARD_LAYOUTS) for (const color of CARD_COLORS) {
    const body = { ...design, layout: layout.id, color: color.id, headline: "Danke <3 ❤", showPhoto: false };
    const response = await PATCH(req(a.token, body), ctx); expect(response.status).toBe(200);
    ({ design } = await response.json()); expect(design.layout).toBe(layout.id); expect(design.color).toBe(color.id);
    const stored = await getCardDesign(a.driver.id); expect(stored.headline).toBe("Danke <3 ❤");
    const web = await renderDriverCard(a.driver, a.user, "native-card", null);
    const native = await (await code(req(a.token), ctx)).json(); expect(native.cardSvg).toBe(web);
    expect(web).toContain(`fill="${layout.id === "brand" ? color.solid : color.light}"`);
    expect(web).toContain('fill="#ff4d4a">❤</tspan>'); expect(web).toContain(a.driver.code);
    expect((await (await GET(req(a.token), ctx)).json()).design).toEqual(design);
  }
  expect(await getDb().cardDesigns.count({ where: { driverId: a.driver.id } })).toBe(1);
});

it("rejects stale and simultaneous saves rather than overwriting a web/app change", async () => {
  const a = await device(); const { design } = await (await GET(req(a.token), ctx)).json();
  const responses = await Promise.all([PATCH(req(a.token, { ...design, headline: "App" }), ctx), PATCH(req(a.token, { ...design, headline: "Web" }), ctx)]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  const newer = await getCardDesign(a.driver.id); expect(newer.updatedAt).not.toBe(design.updatedAt);
  await expect(saveCardDesign(a.driver.id, { ...design, headline: "stale" }, design.updatedAt)).rejects.toMatchObject({ code: "card_changed" });
  expect((await getCardDesign(a.driver.id)).headline).toBe(newer.headline);
});

it("cannot change another driver's design, owner, code or private fields via mass assignment", async () => {
  const a = await device(), b = await device(); const { design } = await (await GET(req(a.token), ctx)).json();
  const original = await getCardDesign(b.driver.id);
  expect((await PATCH(req(a.token, { ...design, headline: "Nur meine Karte", driverId: b.driver.id, id: original.id, code: b.driver.code, role: "admin", photoHref: "https://evil.invalid" }), ctx)).status).toBe(200);
  expect(await getCardDesign(b.driver.id)).toEqual(original); expect((await getCardDesign(a.driver.id)).headline).toBe("Nur meine Karte");
  expect((await getDb().driverProfiles.get(a.driver.id))?.code).toBe(a.driver.code);
});

it("rejects invalid fields and does not save anything on validation failure", async () => {
  const a = await device(); const { design } = await (await GET(req(a.token), ctx)).json();
  for (const patch of [{ color: "#fff;script" }, { layout: "evil" }, { headline: "x".repeat(61) }, { showPhoto: "true" }, { showRankBadge: "false" }, { updatedAt: "invalid" }]) {
    expect((await PATCH(req(a.token, { ...design, ...patch }), ctx)).status).toBe(400);
    expect((await getCardDesign(a.driver.id)).updatedAt).toBe(design.updatedAt);
  }
  expect((await PATCH(new Request("http://localhost/api/v1/me/card", { method: "PATCH", headers: { authorization: `Bearer ${a.token}` }, body: "{" }), ctx)).status).toBe(400);
});

it("reuses the normalized private profile photo without exposing another user's photo", async () => {
  const a = await device(); await getDb().driverProfiles.update(a.driver.id, { photoKey: "owner" });
  const photo = await import("@/server/services/profile"); vi.spyOn(photo, "readDriverPhoto").mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
  const result = await (await GET(req(a.token), ctx)).json(); expect(result.context.photoHref).toBe("data:image/jpeg;base64,AQID");
  expect((await GET(req(), ctx)).status).toBe(401);
});

it("creates a missing historical design only once under concurrent reads", async () => {
  const a = await device(); const old = await getCardDesign(a.driver.id); await getDb().cardDesigns.remove(old.id);
  const designs = await Promise.all([getCardDesign(a.driver.id), getCardDesign(a.driver.id), getCardDesign(a.driver.id)]);
  expect(new Set(designs.map(d => d.id)).size).toBe(1);
});

it("shares the saved badge choice across API, web card and native PDF source without changing the QR", async () => {
  const a = await device();
  await getDb().thankYous.insert({ id: newId(), driverId: a.driver.id, tipId: null, customerId: null, presetId: null, message: null, createdAt: new Date().toISOString() });
  let { design } = await (await GET(req(a.token), ctx)).json();
  expect(design.showRankBadge).toBe(true);
  for (const layout of CARD_LAYOUTS) {
    const hidden = await PATCH(req(a.token, { ...design, layout: layout.id, showRankBadge: false }), ctx);
    expect(hidden.status).toBe(200);
    ({ design } = await hidden.json());
    expect(design.showRankBadge).toBe(false);
    expect((await getCardDesign(a.driver.id)).showRankBadge).toBe(false);
    const web = await renderDriverCard(a.driver, a.user, "native-card", null);
    const native = await (await code(req(a.token), ctx)).json();
    expect(native.cardSvg).toBe(web);
    expect(web).not.toContain(">Start</text>");
    expect(web).toContain(a.driver.code);
    expect(native.url).toContain(`/danke/${a.driver.code}`);
    expect((await (await GET(req(a.token), ctx)).json()).design.showRankBadge).toBe(false);
  }
  // An older installed app omits the new field; its ordinary edit preserves the choice.
  const legacy = { ...design };
  delete legacy.showRankBadge;
  const oldAppSave = await PATCH(req(a.token, { ...legacy, headline: "Neuer Text" }), ctx);
  expect(oldAppSave.status).toBe(200);
  ({ design } = await oldAppSave.json());
  expect(design.showRankBadge).toBe(false);
  const visible = await PATCH(req(a.token, { ...design, showRankBadge: true }), ctx);
  expect(visible.status).toBe(200);
  expect((await renderDriverCard(a.driver, a.user)).includes(">Start</text>")).toBe(true);
});
