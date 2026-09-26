"use server";

import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { newId } from "@/lib/id";
import { isDemoPayment } from "@/lib/payments";
import { awardMilestones } from "@/lib/milestones";
import { getDriverStats } from "@/lib/stats";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Bestaetigt eine simulierte Zahlung (§81).
 * Existiert ausschliesslich im Demo-Modus. Im Echtbetrieb kommt die
 * Bestaetigung ausschliesslich vom signierten Provider-Webhook (§92).
 */
export async function confirmDemoPayment(tipId: string, succeed: boolean): Promise<void> {
  if (!isDemoPayment()) throw new Error("Demo-Zahlungen sind deaktiviert.");
  if (!rateLimit(await clientKey("demo-pay"), 20, 60_000)) {
    throw new Error("Zu viele Anfragen.");
  }

  const store = getStore();
  const tip = await store.getTipById(tipId);
  if (!tip) throw new Error("Zahlung nicht gefunden.");

  const driver = await store.getDriverById(tip.driverId);
  if (!driver) throw new Error("Zusteller nicht gefunden.");

  if (!succeed) {
    if (tip.paymentStatus === "pending") await store.updateTip(tip.id, { paymentStatus: "failed" });
    redirect(`/danke/${driver.code}?abgebrochen=1`);
  }

  // Idempotent: eine bereits bestaetigte Zahlung wird nicht doppelt gebucht.
  if (tip.paymentStatus !== "succeeded") {
    await store.updateTip(tip.id, { paymentStatus: "succeeded", payoutStatus: "in_balance" });
    await store.createThankYou({
      id: newId(),
      driverId: driver.id,
      presetId: null,
      message: null,
      tipId: tip.id,
      createdAt: new Date().toISOString(),
    });
    const stats = await getDriverStats(driver.id);
    await awardMilestones(driver.id, stats.total.thanks, stats.streakDays);
  }

  redirect(`/danke/${driver.code}/erfolg?trinkgeld=${tip.id}`);
}
