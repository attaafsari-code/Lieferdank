import { beforeEach, expect, it, vi } from "vitest";
import { freshDb, makeDriver, makeCustomer } from "./helpers";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { getDriverRank, rankAdminOverview, saveRewardDraft } from "@/server/services/ranks";
import { refreshMilestones } from "@/server/services/milestones";
import { saveCardDesign, getCardDesign, renderDriverCard } from "@/server/services/cards";
import { sendFreeThankYou, startTip, confirmPayment, markDisputed } from "@/server/services/thanks";
import { refundTip } from "@/server/services/refunds";
import { mobileLogin } from "@/server/services/mobile";
import { GET } from "@/app/api/v1/me/rank/route";
import { PATCH } from "@/app/api/v1/me/card/route";
import { GET as publicDriver } from "@/app/api/v1/drivers/[code]/route";
import { exportUserData, deleteAccount } from "@/server/services/profile";

beforeEach(() => { freshDb(); vi.restoreAllMocks(); vi.stubEnv("DRIVER_APP_ENABLED", "true"); vi.spyOn(console, "info").mockImplementation(() => undefined); });
async function addThanks(driverId: string, count: number) {
  for (let i=0;i<count;i++) await getDb().thankYous.insert({ id: newId(), driverId, tipId: null, customerId: null, presetId: null, message: null, createdAt: new Date().toISOString() });
}

it("enforces rank color eligibility on the server, preserves the saved background on promotion", async () => {
  const { driver } = await makeDriver(); const initial = await getCardDesign(driver.id);
  await expect(saveCardDesign(driver.id, { ...initial, color: "bronze" })).rejects.toMatchObject({ code: "color_locked", status: 403 });
  await addThanks(driver.id,49); expect((await getDriverRank(driver.id)).current?.id).toBe("start");
  await expect(saveCardDesign(driver.id, { ...initial, color: "bronze" })).rejects.toMatchObject({ code: "color_locked" });
  await sendFreeThankYou(driver.code, null, "a".repeat(32));
  expect((await getDriverRank(driver.id)).current?.id).toBe("bronze");
  expect((await getCardDesign(driver.id)).color).toBe(initial.color);
  await saveCardDesign(driver.id, { ...initial, color: "bronze" }, initial.updatedAt);
  expect((await getCardDesign(driver.id)).color).toBe("bronze");
});

it("is idempotent under concurrent milestone refreshes and cannot claim or duplicate a Reward", async () => {
  const { driver } = await makeDriver(); await addThanks(driver.id, 1000);
  await Promise.all(Array.from({ length: 4 }, () => refreshMilestones(driver.id)));
  const records = await getDb().rewardEntitlements.findMany({ where: { driverId: driver.id } });
  expect(records.map(r=>r.threshold).sort((a,b)=>a-b)).toEqual([500,1000]);
  expect(records.every(r=>r.claimedAt===null)).toBe(true);
  await expect(getDb().rewardEntitlements.insert({ ...records[0], id: newId() })).rejects.toThrow("reward_entitlements_driver_threshold_key");
  const badges = await getDb().milestones.findMany({ where: { driverId: driver.id, type: "thank_you_count" } });
  expect(badges.map(b=>b.value).sort((a,b)=>a-b)).toEqual([1,50,100,500,1000]);
  expect((await getDriverRank(driver.id)).rewardsPreview).toBe(true);
});

it("keeps free gratitude, excludes own, refunded, orphan and disputed paid thanks, and revokes earned colors without overwriting designs", async () => {
  const { user, driver } = await makeDriver(); await addThanks(driver.id,49);
  const checkout = await startTip(driver.code, 200, null); await confirmPayment(checkout.paymentId, { providerIntentId: "pi_rank_test" });
  expect((await getDriverRank(driver.id)).count).toBe(50);
  const design = await getCardDesign(driver.id); await saveCardDesign(driver.id, { ...design, color: "bronze" });
  await refundTip({ ...user, role: "admin" }, checkout.tipId, { amountCents: 100, expectedRefundedCents: 0, reason: "Isolierter Rangtest" });
  expect((await getDriverRank(driver.id)).count).toBe(50);
  await refundTip({ ...user, role: "admin" }, checkout.tipId, { amountCents: 100, expectedRefundedCents: 100, reason: "Isolierter Rangtest" });
  expect((await getDriverRank(driver.id)).count).toBe(49);
  expect((await getCardDesign(driver.id)).color).toBe("bronze");
  expect(await renderDriverCard(driver,user)).not.toContain('fill="#875432"');
  expect(await renderDriverCard(driver,user)).toContain(">Start</text>");
  await getDb().thankYous.insert({ id: newId(), driverId: driver.id, customerId: user.id, tipId: null, presetId: null, message: null, createdAt: new Date().toISOString() });
  await getDb().thankYous.insert({ id: newId(), driverId: driver.id, customerId: null, tipId: newId(), presetId: null, message: null, createdAt: new Date().toISOString() });
  expect((await getDriverRank(driver.id)).count).toBe(49);
  const second = await startTip(driver.code, 300, null); await confirmPayment(second.paymentId, { providerIntentId: "pi_rank_dispute" });
  expect((await getDriverRank(driver.id)).count).toBe(50); await markDisputed("pi_rank_dispute",second.paymentId);
  expect((await getDriverRank(driver.id)).count).toBe(49);
});

it("does not let requests select another driver or forge rank, rewards, badge or color", async () => {
  const a=await makeDriver(),b=await makeDriver(); await addThanks(b.driver.id,500);
  const login=await mobileLogin({email:a.user.email,password:"sicheres-passwort"});
  const ctx={params:Promise.resolve({})};
  const req=new Request(`http://localhost/api/v1/me/rank?driverId=${b.driver.id}`,{headers:{authorization:`Bearer ${login.token}`}});
  expect((await (await GET(req,ctx)).json()).count).toBe(0);
  expect((await GET(new Request('http://localhost/api/v1/me/rank'),ctx)).status).toBe(401);
  const customer=await makeCustomer();const c=await mobileLogin({email:customer.email,password:"sicheres-passwort"});
  expect((await GET(new Request('http://localhost/api/v1/me/rank',{headers:{authorization:`Bearer ${c.token}`}}),ctx)).status).toBe(403);
  const old=await getCardDesign(a.driver.id);
  const result=await PATCH(new Request('http://localhost/api/v1/me/card',{method:"PATCH",headers:{authorization:`Bearer ${login.token}`,"content-type":"application/json"},body:JSON.stringify({...old,color:"legend",rank:"legend",driverId:b.driver.id,claimedAt:new Date().toISOString()})}),ctx);
  expect(result.status).toBe(403);expect((await getCardDesign(a.driver.id)).color).toBe("blue");
  const published=await (await publicDriver(new Request('http://localhost?scan=0'),{params:Promise.resolve({code:b.driver.code})})).json();
  expect(published.driver.rank.current.id).toBe("silver");expect(published.driver.rank.count).toBe(500);
  const text=JSON.stringify(published);for(const secret of [b.user.email,b.driver.id,b.user.id,'contentDraft','conditionsDraft','claimedAt','visitorHash'])expect(text).not.toContain(secret);
});

it("restricts Reward configuration to audited private admin drafts and detects concurrent edits", async () => {
  const {user,driver}=await makeDriver();const input={threshold:500,contentDraft:"Interner Entwurf",conditionsDraft:"Nur intern",reason:"Vorbereitung",updatedAt:null};
  await expect(saveRewardDraft(user,input)).rejects.toMatchObject({status:403});
  const admin={...user,role:"admin" as const};
  const revision=await saveRewardDraft(admin,input);const draft=(await getDb().rewardDefinitions.findMany())[0];
  expect(revision).toBe(draft.updatedAt);
  expect(draft.contentDraft).toBe(input.contentDraft);expect((await getDb().adminActions.findMany()).length).toBe(1);
  await expect(saveRewardDraft(admin,input)).rejects.toMatchObject({status:409});
  const responses=await Promise.allSettled([saveRewardDraft(admin,{...input,updatedAt:draft.updatedAt,contentDraft:"A"}),saveRewardDraft(admin,{...input,updatedAt:draft.updatedAt,contentDraft:"B"})]);
  expect(responses.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await rankAdminOverview(admin)).items.find(x=>x.code===driver.code)?.progress.count).toBe(0);
  await expect(rankAdminOverview(user)).rejects.toMatchObject({status:403});
  await expect(saveRewardDraft({...admin,blockedAt:new Date().toISOString()},input)).rejects.toMatchObject({status:403});
});

it("includes prepared Reward data in export and removes it during account deletion", async () => {
  const {user,driver}=await makeDriver();await addThanks(driver.id,500);await refreshMilestones(driver.id);
  expect((await exportUserData(user)).rewardVorschau).toHaveLength(1);
  await deleteAccount(user);
  expect(await getDb().rewardEntitlements.count({where:{driverId:driver.id}})).toBe(0);
});
