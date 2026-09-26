"use server";

import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { newId, normalizeCode } from "@/lib/id";
import { isAllowedTipAmount, splitTip, CURRENCY } from "@/lib/money";
import { getPaymentProvider } from "@/lib/payments";
import { baseUrl } from "@/lib/qr";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getDriverStats } from "@/lib/stats";
import { awardMilestones } from "@/lib/milestones";
import { MAX_CUSTOM_MESSAGE_LENGTH, presetById } from "@/lib/messages";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Zusteller, die ein Danke bzw. Trinkgeld empfangen duerfen.
 *
 * Bewusst niedrige Huerde: Wer registriert und nicht gesperrt ist, kann sofort
 * loslegen. Die Pruefung von Identitaet und Bankverbindung uebernimmt der
 * Zahlungsdienstleister beim Einrichten des Auszahlungskontos -- dort, wo sie
 * gesetzlich ohnehin verlangt wird.
 */
async function loadReceivingDriver(code: string) {
  const store = getStore();
  const driver = await store.getDriverByCode(normalizeCode(code));
  if (!driver || !driver.active) return null;
  const user = await store.getUserById(driver.userId);
  if (!user || user.blockedAt) return null;
  return driver;
}

/** Nach jedem Danke pruefen, ob ein Meilenstein erreicht wurde (§16). */
async function refreshMilestones(driverId: string): Promise<void> {
  const stats = await getDriverStats(driverId);
  await awardMilestones(driverId, stats.total.thanks, stats.streakDays);
}

export async function sendFreeThankYou(code: string): Promise<ActionResult> {
  if (!rateLimit(await clientKey("thanks"), 10, 60_000)) {
    return { ok: false, error: "Zu viele Anfragen. Bitte kurz warten." };
  }

  const driver = await loadReceivingDriver(code);
  if (!driver) return { ok: false, error: "Dieser Danke-Code ist nicht aktiv." };

  const thankYou = await getStore().createThankYou({
    id: newId(),
    driverId: driver.id,
    presetId: null,
    message: null,
    tipId: null,
    createdAt: new Date().toISOString(),
  });

  await refreshMilestones(driver.id);
  redirect(`/danke/${driver.code}/erfolg?danke=${thankYou.id}`);
}

export async function startTip(code: string, amountCents: number): Promise<ActionResult> {
  if (!rateLimit(await clientKey("tip"), 10, 60_000)) {
    return { ok: false, error: "Zu viele Anfragen. Bitte kurz warten." };
  }
  if (!isAllowedTipAmount(amountCents)) {
    return { ok: false, error: "Dieser Betrag ist nicht möglich." };
  }

  const driver = await loadReceivingDriver(code);
  if (!driver) return { ok: false, error: "Dieser Danke-Code ist nicht aktiv." };

  const split = splitTip(amountCents);
  const provider = getPaymentProvider();
  const tipId = newId();
  // Nur wenn das Konto bereit ist, kann der Anteil direkt dorthin fliessen.
  const destinationAccountId = driver.payoutReady ? driver.payoutAccountId : null;

  await getStore().createTip({
    id: tipId,
    driverId: driver.id,
    grossCents: split.grossCents,
    driverCents: split.driverCents,
    platformGrossFeeCents: split.platformGrossFeeCents,
    paymentProviderFeeCents: split.paymentProviderFeeCents,
    platformNetRevenueCents: split.platformNetRevenueCents,
    currency: CURRENCY,
    paymentStatus: "pending",
    payoutStatus: "pending",
    provider: provider.id,
    providerPaymentId: null,
    destinationAccountId,
    createdAt: new Date().toISOString(),
  });

  const payment = await provider.createPayment({
    tipId,
    driverId: driver.id,
    grossCents: split.grossCents,
    driverCents: split.driverCents,
    platformFeeCents: split.platformGrossFeeCents,
    destinationAccountId,
    description: `Danke an ${driver.displayName} (Lieferdank)`,
    returnUrl: `${baseUrl()}/danke/${driver.code}/erfolg?trinkgeld=${tipId}`,
    cancelUrl: `${baseUrl()}/danke/${driver.code}?abgebrochen=1`,
  });

  await getStore().updateTip(tipId, { providerPaymentId: payment.providerPaymentId });

  if (!payment.redirectUrl) {
    return { ok: false, error: "Zahlung konnte nicht gestartet werden." };
  }
  redirect(payment.redirectUrl);
}

export async function attachMessage(
  thankYouId: string,
  presetId: string | null,
  customMessage: string | null,
): Promise<ActionResult> {
  if (!rateLimit(await clientKey("message"), 20, 60_000)) {
    return { ok: false, error: "Zu viele Anfragen. Bitte kurz warten." };
  }

  const store = getStore();
  const thankYou = await store.getThankYouById(thankYouId);
  if (!thankYou) return { ok: false, error: "Nachricht konnte nicht zugeordnet werden." };
  // Eine einmal gesendete Nachricht bleibt stehen: kein nachtraegliches Ueberschreiben.
  if (thankYou.presetId || thankYou.message) return { ok: true };

  const preset = presetById(presetId);
  const trimmed = (customMessage ?? "").trim().slice(0, MAX_CUSTOM_MESSAGE_LENGTH);
  if (!preset && !trimmed) return { ok: true };

  await store.updateThankYou(thankYou.id, {
    presetId: preset?.id ?? null,
    message: trimmed || null,
  });

  return { ok: true };
}
