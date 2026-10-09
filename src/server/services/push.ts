import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import type { MobileSession, PushDelivery } from "@/lib/db/types";
import type { Session } from "../session";
import { deviceId } from "./mobile";
import { parseInput } from "./auth";
import { ServiceError } from "../errors";
import { logEvent } from "../events";

export async function registerPush(session: Session, input: unknown) {
  const value = parseInput(z.object({ token: z.string().max(250).regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/), enabled: z.boolean() }), input);
  const id = deviceId(session);
  // Do not let another account take over a still-active device token.
  const existing = await getDb().mobileSessions.findOne({ pushToken: value.token });
  if (existing && existing.id !== id && existing.userId !== session.user.id && !existing.revokedAt)
    throw new ServiceError("token_in_use", "Melde dich auf diesem Gerät zuerst vom bisherigen Konto ab.", 409);
  if (existing && existing.id !== id) await getDb().mobileSessions.update(existing.id, { pushToken: null, pushEnabled: false });
  await getDb().mobileSessions.update(id, { pushToken: value.enabled ? value.token : null, pushEnabled: value.enabled });
}
function deliveryId(sessionId: string, eventKey: string) {
  const hash = createHash("sha256").update(`${sessionId}:${eventKey}`).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
export async function queuePush(device: MobileSession, event: Pick<PushDelivery, "eventKey" | "title" | "body" | "screen">) {
  const db = getDb(); const id = deliveryId(device.id, event.eventKey);
  if (await db.pushDeliveries.get(id)) return;
  try { await db.pushDeliveries.insert({ id, sessionId: device.id, ...event, status: "pending", ticketId: null, tokenAtSend: null, leaseUntil: null, attempts: 0, createdAt: new Date().toISOString() }); }
  catch (error) { if (!await db.pushDeliveries.get(id)) throw error; }
}
/** Derive notifications exclusively from confirmed backend records, never redirects. */
export async function collectPushEvents() {
  const db = getDb();
  const devices = await db.mobileSessions.findMany({ where: { pushEnabled: true, revokedAt: null } });
  for (const device of devices) {
    if (!device.pushToken || new Date(device.expiresAt).getTime() <= Date.now()) continue;
    const user = await db.users.get(device.userId); if (!user || user.blockedAt || user.tokenVersion !== device.tokenVersion) continue;
    const driver = await db.driverProfiles.findOne({ userId: device.userId }); if (!driver?.notifyOnTip) continue;
    const tips = await db.tips.findMany({ where: { driverId: driver.id }, since: { field: "createdAt", value: device.createdAt } });
    for (const tip of tips) {
      if (tip.paymentStatus === "succeeded" && tip.refundedCents === 0)
        await queuePush(device, { eventKey: `tip:${tip.id}`, title: "LieferDank", body: `🎉 Du hast gerade ${(tip.grossCents / 100).toLocaleString("de-DE")} € Trinkgeld erhalten`, screen: "earnings" });
      if (tip.refundedCents > 0 || tip.paymentStatus === "review_required")
        await queuePush(device, { eventKey: `status:${tip.id}:${tip.refundedCents}:${tip.paymentStatus}`, title: "Trinkgeld aktualisiert", body: "Es gibt eine Änderung zu einem Trinkgeld. Details findest du in deinen Einnahmen.", screen: "earnings" });
    }
    const thanks = await db.thankYous.findMany({ where: { driverId: driver.id, tipId: null }, since: { field: "createdAt", value: device.createdAt } });
    for (const thank of thanks)
      await queuePush(device, { eventKey: `thanks:${thank.id}`, title: "LieferDank", body: thank.message ? "❤️ Du hast eine neue Nachricht erhalten" : "❤️ Du hast ein neues Danke erhalten", screen: "thanks" });
  }
}
export async function deliverPush(fetcher: typeof fetch = fetch) {
  const db = getDb(); const now = new Date(); let sent = 0;
  const deadline = Date.now() + 55000;
  const rows = await db.pushDeliveries.findMany({ orderBy: "createdAt", limit: 200, where: { status: "pending" } });
  const abandoned = await db.pushDeliveries.findMany({ where: { status: "sending" }, limit: 100 });
  for (const row of [...rows, ...abandoned.filter(r => r.leaseUntil && r.leaseUntil < now.toISOString())]) {
    if (Date.now() >= deadline) break;
    const device = await db.mobileSessions.get(row.sessionId);
    const user = device ? await db.users.get(device.userId) : null;
    const owner = device ? await db.driverProfiles.findOne({ userId: device.userId }) : null;
    if (!owner?.notifyOnTip || !device?.pushToken || !device.pushEnabled || device.revokedAt || !user || user.blockedAt || user.tokenVersion !== device.tokenVersion || device.expiresAt <= now.toISOString()) {
      await db.pushDeliveries.update(row.id, { status: "failed" }); continue;
    }
    if (row.eventKey.startsWith("tip:")) {
      const tip = await db.tips.get(row.eventKey.slice(4));
      const owner = await db.driverProfiles.findOne({ userId: device.userId });
      if (!tip || tip.driverId !== owner?.id || tip.paymentStatus !== "succeeded" || tip.refundedCents > 0) {
        await db.pushDeliveries.update(row.id, { status: "failed" }); continue;
      }
    }
    if (row.attempts >= 5) { await db.pushDeliveries.update(row.id, { status: "failed" }); continue; }
    if (!await db.pushDeliveries.updateIf(row.id, { status: row.status, attempts: row.attempts }, { status: "sending", tokenAtSend: device.pushToken, attempts: row.attempts + 1, leaseUntil: new Date(Date.now() + 120000).toISOString() })) continue;
    try {
      const response = await fetcher("https://exp.host/--/api/v2/push/send", { method: "POST", signal: AbortSignal.timeout(10000),
        headers: { "content-type": "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
        body: JSON.stringify({ to: device.pushToken, title: row.title, body: row.body, sound: "default", data: { screen: row.screen, notificationId: row.id } }) });
      if (!response.ok) throw new Error("push_provider_unavailable");
      const payload = await response.json(); const ticket = payload.data;
      if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        await db.mobileSessions.updateIf(device.id, { pushToken: device.pushToken }, { pushToken: null, pushEnabled: false });
        await db.pushDeliveries.update(row.id, { status: "failed", leaseUntil: null }); continue;
      }
      if (ticket?.status !== "ok" || typeof ticket.id !== "string") throw new Error("push_ticket_invalid");
      await db.pushDeliveries.update(row.id, { status: "sent", ticketId: ticket.id, leaseUntil: null }); sent++;
    } catch {
      await db.pushDeliveries.update(row.id, { status: "pending", leaseUntil: null });
      await logEvent("warning", "push", "Push-Zustellung wird erneut versucht", { deliveryId: row.id });
    }
  }
  return sent;
}
export async function checkPushReceipts(fetcher: typeof fetch = fetch) {
  const db = getDb(); const sent = await db.pushDeliveries.findMany({ where: { status: "sent" }, limit: 100 });
  const items = sent.filter(r => r.ticketId);
  if (!items.length) return;
  const response = await fetcher("https://exp.host/--/api/v2/push/getReceipts", { method: "POST", signal: AbortSignal.timeout(10000),
    headers: { "content-type": "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) }, body: JSON.stringify({ ids: items.map(r => r.ticketId) }) });
  if (!response.ok) throw new Error("push_receipts_unavailable");
  const body = await response.json();
  for (const item of items) {
    const receipt = body.data?.[item.ticketId!]; if (!receipt) continue;
    if (receipt.details?.error === "DeviceNotRegistered") {
      await db.mobileSessions.updateIf(item.sessionId, { pushToken: item.tokenAtSend }, { pushToken: null, pushEnabled: false });
    }
    await db.pushDeliveries.update(item.id, { ticketId: null, status: receipt.status === "ok" ? "delivered" : "failed" });
  }
}

export async function cleanupMobileData() {
  const db = getDb(); const now = new Date().toISOString();
  for (const device of await db.mobileSessions.findMany({ orderBy: "createdAt", limit: 1000 })) {
    if (device.expiresAt > now && !device.revokedAt) continue;
    for (const delivery of await db.pushDeliveries.findMany({ where: { sessionId: device.id } })) await db.pushDeliveries.remove(delivery.id);
    await db.mobileSessions.remove(device.id);
  }
}
