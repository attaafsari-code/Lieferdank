import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb, makeDriver, makeCustomer } from "./helpers";
import { getDb } from "@/lib/db";
import { getBearerSession, signSessionToken } from "@/server/session";
import { mobileLogin, mobileLogout, changeMobilePassword } from "@/server/services/mobile";
import { POST as loginRoute } from "@/app/api/v1/auth/mobile/login/route";
import { GET as earningsRoute } from "@/app/api/v1/me/earnings/route";
import { GET as thanksRoute } from "@/app/api/v1/me/thanks/route";
import { GET as profileGet, PATCH as profileRoute } from "@/app/api/v1/me/profile/route";
import { GET as stripeRoute } from "@/app/api/v1/me/stripe/route";
import { POST as stripeStart } from "@/app/api/v1/me/stripe/route";
import { PUT as photoRoute } from "@/app/api/v1/me/photo/route";
import { POST as resetRoute } from "@/app/api/v1/auth/reset/route";
import { GET as pushCron } from "@/app/api/cron/push/route";
import { registerPush, queuePush, deliverPush, collectPushEvents, checkPushReceipts } from "@/server/services/push";
import { startTip, confirmPayment } from "@/server/services/thanks";

let ip = 0;
const ctx = { params: Promise.resolve({}) };
function req(path: string, token?: string, body?: unknown, method = "GET") { return new Request(`http://localhost${path}`, { method, headers: { "x-forwarded-for": `10.88.${Math.floor(++ip/200)}.${ip%200}`, ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
async function device() { const { user, driver } = await makeDriver(); const { token } = await mobileLogin({ email: user.email, password: "sicheres-passwort" }); const session = (await getBearerSession(req("/", token)))!; return { user, driver, token, session }; }
beforeEach(() => { freshDb(); vi.restoreAllMocks(); vi.spyOn(console, "info").mockImplementation(() => undefined); });

describe("Native device authentication", () => {
  it("uses existing users and creates a revocable device session", async () => { const d = await device(); expect(d.session.user.id).toBe(d.user.id); expect(d.session.mobileSessionId).toBeTruthy(); expect(await getDb().users.count()).toBe(1); });
  it("logout revokes copied bearer tokens but leaves other devices valid", async () => { const d = await device(); const other = await mobileLogin({ email:d.user.email,password:"sicheres-passwort" }); await mobileLogout(d.session); expect(await getBearerSession(req("/",d.token))).toBeNull(); expect(await getBearerSession(req("/",other.token))).not.toBeNull(); });
  it("rejects expired device rows even while JWT has time remaining", async () => { const d=await device(); await getDb().mobileSessions.update(d.session.mobileSessionId!,{ expiresAt:new Date(0).toISOString() }); expect(await getBearerSession(req("/",d.token))).toBeNull(); });
  it("rejects customers without creating sessions",async()=>{ const u=await makeCustomer(); await expect(mobileLogin({email:u.email,password:"sicheres-passwort"})).rejects.toMatchObject({code:"driver_only"});expect(await getDb().mobileSessions.count()).toBe(0); });
  it("invalid password returns 401 with no token",async()=>{const d=await makeDriver();const r=await loginRoute(req("/api/v1/auth/mobile/login",undefined,{email:d.user.email,password:"wrong"},"POST"),ctx);expect(r.status).toBe(401);expect(await r.json()).not.toHaveProperty("token");});
  it("password change revokes all old sessions",async()=>{const d=await device();const web=await signSessionToken(d.user);await changeMobilePassword(d.session,{currentPassword:"sicheres-passwort",newPassword:"anderes-passwort"});expect(await getBearerSession(req("/",d.token))).toBeNull();expect(await getBearerSession(req("/",web))).toBeNull();});
  it("never exposes reset tokens in API responses",async()=>{const d=await makeDriver();const r=await resetRoute(req("/api/v1/auth/reset",undefined,{email:d.user.email},"POST"),ctx);expect(await r.json()).toEqual({ok:true});});
});
describe("Driver API ownership and private projections",()=>{
  it("a fetched profile with null optional fields can be saved and cleared",async()=>{
    const d=await device();
    await getDb().users.update(d.user.id,{phone:null});
    const profile=await(await profileGet(req("/api/v1/me/profile",d.token),ctx)).json();
    expect(profile.phone).toBeNull();expect(profile.bio).toBeNull();
    const saved=await profileRoute(req("/api/v1/me/profile",d.token,{...profile,firstName:"App Name",bio:"Updated"},"PATCH"),ctx);
    expect(saved.status).toBe(200);expect((await getDb().driverProfiles.get(d.driver.id))?.bio).toBe("Updated");
    const cleared=await profileRoute(req("/api/v1/me/profile",d.token,{...profile,bio:null},"PATCH"),ctx);
    expect(cleared.status).toBe(200);expect((await getDb().driverProfiles.get(d.driver.id))?.bio).toBeNull();
  });
  it("ignores cookies for writes and private reads",async()=>{const d=await makeDriver(); const r=await earningsRoute(new Request("http://localhost/api/v1/me/earnings",{headers:{cookie:`ld_session=${await signSessionToken(d.user)}`}}),ctx);expect(r.status).toBe(401);});
  it("only returns caller earnings and messages",async()=>{const a=await device();const b=await device();await getDb().thankYous.insert({id:crypto.randomUUID(),driverId:b.driver.id,tipId:null,customerId:null,presetId:null,message:"private B",freeDay:null,visitorHash:null,createdAt:new Date().toISOString()});const r=await thanksRoute(req("/api/v1/me/thanks",a.token),ctx);expect(await r.json()).toEqual({items:[],nextCursor:null});});
  it("cannot mass assign Stripe account, role, owner, or carrier through profile",async()=>{const a=await device();const b=await device();const r=await profileRoute(req("/api/v1/me/profile",a.token,{firstName:"Anna",lastName:"Test",nameDisplay:"custom",customName:"Anna",photoPublic:true,active:true,providerId:"dhl",providerPublic:true,notifyOnTip:true,role:"admin",userId:b.user.id,payoutReady:true,payoutAccountId:"acct_attacker"},"PATCH"),ctx);expect(r.status).toBe(200);const row=await getDb().driverProfiles.get(a.driver.id);expect(row?.userId).toBe(a.user.id);expect(row?.payoutAccountId).toBeNull();expect(row?.payoutReady).toBe(false);expect(row?.providerId).toBe(a.driver.providerId);expect((await getDb().users.get(a.user.id))?.role).toBe("driver");});
  it("refuses Stripe activation with unverified email",async()=>{const {user}=await makeDriver({emailVerified:false});const d=await mobileLogin({email:user.email,password:"sicheres-passwort"});const r=await stripeStart(req("/api/v1/me/stripe",d.token,{immediateStart:true},"POST"),ctx);expect(r.status).toBe(403);});
  it("does not disclose Stripe account IDs in status",async()=>{const d=await device();const r=await stripeRoute(req("/api/v1/me/stripe",d.token),ctx);expect(await r.json()).not.toHaveProperty("payoutAccountId");});
  it("decodes images instead of trusting declared MIME",async()=>{const d=await device();const r=await photoRoute(new Request("http://localhost/api/v1/me/photo",{method:"PUT",headers:{authorization:`Bearer ${d.token}`,"content-type":"image/png"},body:"<svg><script>alert(1)</script></svg>"}),ctx);expect(r.status).toBe(400);expect((await getDb().driverProfiles.get(d.driver.id))?.photoKey).toBeNull();});
  it("cron requires secret and does not send by default",async()=>{expect((await pushCron(req("/api/cron/push"),ctx)).status).toBe(401);});
});
describe("Confirmed push, deduplication and logout",()=>{
  const event={eventKey:"test:one",title:"LieferDank",body:"Danke",screen:"thanks" as const};
  async function ready(){const d=await device();await registerPush(d.session,{token:`ExpoPushToken[${d.driver.code.replaceAll("-","")}]`,enabled:true});const row=(await getDb().mobileSessions.get(d.session.mobileSessionId!))!;return {...d,row};}
  it("rejects arbitrary push tokens",async()=>{const d=await device();await expect(registerPush(d.session,{token:"https://evil.invalid",enabled:true})).rejects.toMatchObject({code:"invalid_input"});});
  it("does not let another driver claim an active token",async()=>{const a=await ready(),b=await device();await expect(registerPush(b.session,{token:a.row.pushToken,enabled:true})).rejects.toMatchObject({code:"token_in_use"});});
  it("parallel queue and send attempts send exactly one normal event",async()=>{const d=await ready();await Promise.all([queuePush(d.row,event),queuePush(d.row,event),queuePush(d.row,event)]);const fetcher=vi.fn(async()=>Response.json({data:{status:"ok",id:"ticket"}}));await Promise.all([deliverPush(fetcher),deliverPush(fetcher)]);expect(fetcher).toHaveBeenCalledTimes(1);expect(await getDb().pushDeliveries.count()).toBe(1);});
  it("logout suppresses already queued notifications",async()=>{const d=await ready();await queuePush(d.row,event);await mobileLogout(d.session);const fetcher=vi.fn();await deliverPush(fetcher);expect(fetcher).not.toHaveBeenCalled();});
  it("web password-reset version change suppresses push",async()=>{const d=await ready();await queuePush(d.row,event);await getDb().users.update(d.user.id,{tokenVersion:d.user.tokenVersion+1});const fetcher=vi.fn();await deliverPush(fetcher);expect(fetcher).not.toHaveBeenCalled();});
  it("removes invalid tokens reported by provider",async()=>{const d=await ready();await queuePush(d.row,event);await deliverPush(vi.fn(async()=>Response.json({data:{status:"error",details:{error:"DeviceNotRegistered"}}})));expect((await getDb().mobileSessions.get(d.row.id))?.pushToken).toBeNull();});
  it("removes invalid tokens reported by a receipt",async()=>{const d=await ready();await queuePush(d.row,event);await deliverPush(vi.fn(async()=>Response.json({data:{status:"ok",id:"receipt"}})));await checkPushReceipts(vi.fn(async()=>Response.json({data:{receipt:{status:"error",details:{error:"DeviceNotRegistered"}}}})));expect((await getDb().mobileSessions.get(d.row.id))?.pushToken).toBeNull();});
  it("pending and failed payments do not create tip pushes",async()=>{const d=await ready();await startTip(d.driver.code,300,null);await collectPushEvents();expect(await getDb().pushDeliveries.count()).toBe(0);});
  it("queues a free thank-you once for its owner without leaking message content",async()=>{
    const d=await ready(),other=await device();
    await getDb().thankYous.insert({id:crypto.randomUUID(),driverId:d.driver.id,tipId:null,customerId:null,presetId:null,message:"private text",freeDay:null,visitorHash:null,createdAt:new Date().toISOString()});
    await getDb().thankYous.insert({id:crypto.randomUUID(),driverId:other.driver.id,tipId:null,customerId:null,presetId:null,message:"other owner",freeDay:null,visitorHash:null,createdAt:new Date().toISOString()});
    await collectPushEvents();await collectPushEvents();const rows=await getDb().pushDeliveries.findMany();
    expect(rows).toHaveLength(1);expect(rows[0].sessionId).toBe(d.row.id);expect(rows[0].screen).toBe("thanks");expect(rows[0].body).not.toContain("private text");
  });
  it("completed receipts do not starve later batches",async()=>{
    const d=await ready();for(let i=0;i<101;i++)await queuePush(d.row,{...event,eventKey:`batch:${i}`});
    let ticket=0;await deliverPush(vi.fn(async()=>Response.json({data:{status:"ok",id:`receipt-${++ticket}`}})));
    const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{const {ids}=JSON.parse(String(init?.body));return Response.json({data:Object.fromEntries(ids.map((id:string)=>[id,{status:"ok"}]))});});
    await checkPushReceipts(fetcher);expect(await getDb().pushDeliveries.count({where:{status:"delivered"}})).toBe(100);
    await checkPushReceipts(fetcher);expect(await getDb().pushDeliveries.count({where:{status:"delivered"}})).toBe(101);
  });
  it("confirmed payment uses exact gross amount and queues once across retries",async()=>{const d=await ready();const payment=await startTip(d.driver.code,300,null);await confirmPayment(payment.paymentId,{providerIntentId:"pi_mobile",method:"card"});await collectPushEvents();await collectPushEvents();const rows=await getDb().pushDeliveries.findMany();expect(rows).toHaveLength(1);expect(rows[0].body).toContain("3 €");const earnings=await earningsRoute(req("/api/v1/me/earnings",d.token),ctx);expect((await earnings.json()).items[0].shareBeforeStripeCents).toBe(240);});
});

describe("Native paging and deletion",()=>{
  it("does not skip thanks with identical timestamps at page boundaries",async()=>{
    const d=await device();const time=new Date().toISOString();
    for(let i=0;i<4;i++)await getDb().thankYous.insert({id:crypto.randomUUID(),driverId:d.driver.id,tipId:null,customerId:null,presetId:null,message:String(i),freeDay:null,visitorHash:null,createdAt:time});
    const first=await(await thanksRoute(req("/api/v1/me/thanks?limit=2",d.token),ctx)).json();
    const second=await(await thanksRoute(req(`/api/v1/me/thanks?limit=2&before=${first.nextCursor}`,d.token),ctx)).json();
    expect(new Set([...first.items,...second.items].map((x:{id:string})=>x.id)).size).toBe(4);
  });
  it("rejects malformed or injected cursors before database calls",async()=>{const d=await device();const r=await earningsRoute(req("/api/v1/me/earnings?before=bad",d.token),ctx);expect(r.status).toBe(400);});
  it("removes app tokens and pending notifications when deleting account",async()=>{
    const d=await device();await registerPush(d.session,{token:"ExpoPushToken[deletedAccount]",enabled:true});const row=(await getDb().mobileSessions.get(d.session.mobileSessionId!))!;
    await queuePush(row,{eventKey:"delete",title:"test",body:"test",screen:"thanks"});
    const {removeMobileAccount}=await import("@/server/services/mobile");await removeMobileAccount(d.session,{password:"sicheres-passwort"});
    expect(await getDb().mobileSessions.count()).toBe(0);expect(await getDb().pushDeliveries.count()).toBe(0);expect(await getBearerSession(req("/",d.token))).toBeNull();
  });
  it("an old invalid receipt cannot erase a newer push token",async()=>{
    const d=await device();await registerPush(d.session,{token:"ExpoPushToken[oldToken]",enabled:true});const row=(await getDb().mobileSessions.get(d.session.mobileSessionId!))!;
    await queuePush(row,{eventKey:"old",title:"test",body:"test",screen:"thanks"});await deliverPush(vi.fn(async()=>Response.json({data:{status:"ok",id:"oldTicket"}})));
    await registerPush(d.session,{token:"ExpoPushToken[newToken]",enabled:true});
    await checkPushReceipts(vi.fn(async()=>Response.json({data:{oldTicket:{status:"error",details:{error:"DeviceNotRegistered"}}}})));
    expect((await getDb().mobileSessions.get(row.id))?.pushToken).toBe("ExpoPushToken[newToken]");
  });
});

it("a temporary database outage is 500 rather than a destructive session-expiry 401",async()=>{
  const d=await device();vi.spyOn(getDb().users,"get").mockRejectedValueOnce(new Error("temporary connection failure"));
  const response=await earningsRoute(req("/api/v1/me/earnings",d.token),ctx);expect(response.status).toBe(500);
  expect(await getBearerSession(req("/",d.token))).not.toBeNull();
});
it("driver cannot remove another driver's message",async()=>{
  const a=await device(),b=await device();const id=crypto.randomUUID();
  await getDb().thankYous.insert({id,driverId:b.driver.id,tipId:null,customerId:null,presetId:null,message:"B",freeDay:null,visitorHash:null,createdAt:new Date().toISOString()});
  const {DELETE}=await import("@/app/api/v1/me/thanks/[id]/route");
  const response=await DELETE(req(`/api/v1/me/thanks/${id}`,a.token,undefined,"DELETE"),{params:Promise.resolve({id})});
  expect(response.status).toBe(404);expect((await getDb().thankYous.get(id))?.message).toBe("B");
});

describe("Native registration uses the existing verified-email lifecycle", () => {
  it("creates exactly one driver, a unique QR and a revocable app session, ignoring role injection", async () => {
    const { POST } = await import("@/app/api/v1/auth/mobile/register/route");
    const body = { firstName: "Anna", lastName: "Test", email: "native-register@example.invalid", password: "sicheres-passwort", acceptedTerms: true, role: "admin" };
    const response = await POST(req("/api/v1/auth/mobile/register", undefined, body, "POST"), ctx);
    expect(response.status).toBe(200);
    const { token } = await response.json();
    const session = (await getBearerSession(req("/", token)))!;
    expect(session.user.role).toBe("driver"); expect(session.user.emailVerifiedAt).toBeNull();
    expect(session.mobileSessionId).toBeTruthy(); expect(session.driver!.code).toMatch(/^LD-[A-Z0-9]+$/);
    const duplicate = await POST(req("/api/v1/auth/mobile/register", undefined, body, "POST"), ctx);
    expect(duplicate.status).toBe(409); expect(await getDb().users.count()).toBe(1);
    await mobileLogout(session); expect(await getBearerSession(req("/", token))).toBeNull();
  });
  it("refuses registration without explicit terms acceptance and production enablement", async () => {
    const { mobileRegister } = await import("@/server/services/mobile");
    await expect(mobileRegister({ firstName: "Anna", lastName: "Test", email: "native-invalid@example.invalid", password: "sicheres-passwort", acceptedTerms: false })).rejects.toMatchObject({ code: "invalid_input" });
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DRIVER_APP_ENABLED", "false");
    try { await expect(mobileRegister({})).rejects.toMatchObject({ code: "app_unavailable", status: 503 }); }
    finally { vi.unstubAllEnvs(); }
    expect(await getDb().users.count()).toBe(0);
  });
  it("returns the same personalized digital card renderer with escaped profile content", async () => {
    const d = await device();
    await getDb().driverProfiles.update(d.driver.id, { nameDisplay: "custom", customName: "A < B" });
    const { GET } = await import("@/app/api/v1/me/code/route");
    const response = await GET(req("/api/v1/me/code", d.token), ctx);
    const data = await response.json(); expect(response.status).toBe(200);
    expect(data.url).toContain(`/danke/${d.driver.code}`);
    expect(data.cardSvg).toContain("A &lt; B"); expect(data.cardSvg).toContain(d.driver.code);
  });
});
it("embeds only an authenticated driver's private normalized photo in the native card", async () => {
  const d = await device();
  await getDb().driverProfiles.update(d.driver.id, { photoKey: "private-test-photo", photoPublic: false });
  const design = (await getDb().cardDesigns.findOne({ driverId: d.driver.id }))!;
  await getDb().cardDesigns.update(design.id, { layout: "personal", showPhoto: true });
  const profileService = await import("@/server/services/profile");
  vi.spyOn(profileService, "readDriverPhoto").mockResolvedValueOnce({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
  const { GET } = await import("@/app/api/v1/me/code/route");
  const response = await GET(req("/api/v1/me/code", d.token), ctx);
  expect((await response.json()).cardSvg).toContain("data:image/jpeg;base64,AQID");
  expect((await GET(req("/api/v1/me/code"), ctx)).status).toBe(401);
});
