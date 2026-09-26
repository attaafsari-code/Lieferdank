import "server-only";
import { getDb } from "@/lib/db";
import type { Payment, Tip } from "@/lib/db/types";
import { newId } from "@/lib/id";
import { CURRENCY, isAllowedTipAmount, MAX_TIP_CENTS, MIN_TIP_CENTS, splitTip } from "@/lib/money";
import { MAX_CUSTOM_MESSAGE_LENGTH, presetById } from "@/lib/messages";
import { formatEuro } from "@/lib/format";
import { ServiceError, notFound } from "../errors";
import { getPaymentProvider } from "../payments";
import { baseUrl } from "../site";
import { sendMail } from "../mail";
import { emails } from "../emails";
import { logEvent, errorMessage } from "../events";
import { driverPublicName, findReceivingDriver } from "./drivers";
import { refreshMilestones } from "./milestones";

/**
 * Der Kernablauf: Danke sagen und Trinkgeld geben.
 * Wird von der Web-App (Server Actions) und der API gleichermaßen genutzt.
 */

const inactive = () => new ServiceError("inactive", "Dieser Danke-Code ist gerade nicht aktiv.", 404);

export async function recordScan(driverId: string): Promise<void> {
  await getDb().scans.insert({ id: newId(), driverId, createdAt: new Date().toISOString() });
}

export async function sendFreeThankYou(code: string, customerId: string | null): Promise<{ thankYouId: string; code: string }> {
  const found = await findReceivingDriver(code);
  if (!found) throw inactive();

  const thankYou = await getDb().thankYous.insert({
    id: newId(),
    driverId: found.driver.id,
    tipId: null,
    customerId,
    presetId: null,
    message: null,
    createdAt: new Date().toISOString(),
  });

  await refreshMilestones(found.driver.id);
  return { thankYouId: thankYou.id, code: found.driver.code };
}

export async function startTip(
  code: string,
  amountCents: number,
  customerId: string | null,
): Promise<{ tipId: string; paymentId: string; redirectUrl: string }> {
  if (!isAllowedTipAmount(amountCents)) {
    throw new ServiceError(
      "invalid_amount",
      `Möglich sind ${formatEuro(MIN_TIP_CENTS)} bis ${formatEuro(MAX_TIP_CENTS)}.`,
      400,
      "amount",
    );
  }

  const found = await findReceivingDriver(code);
  if (!found) throw inactive();
  const { driver, user } = found;

  const db = getDb();
  const provider = getPaymentProvider();
  const split = splitTip(amountCents);
  const now = new Date().toISOString();
  const tipId = newId();
  const paymentId = newId();
  // Nur ein einsatzbereites Konto kann den Anteil direkt empfangen.
  const destinationAccountId = driver.payoutReady ? driver.payoutAccountId : null;

  await db.payments.insert({
    id: paymentId,
    purpose: "tip",
    referenceId: tipId,
    provider: provider.id,
    providerPaymentId: null,
    providerIntentId: null,
    amountCents: split.grossCents,
    currency: CURRENCY,
    status: "pending",
    method: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.tips.insert({
    id: tipId,
    driverId: driver.id,
    paymentId,
    customerId,
    ...split,
    currency: CURRENCY,
    paymentStatus: "pending",
    payoutStatus: "pending",
    payoutId: null,
    destinationAccountId,
    createdAt: now,
  });

  try {
    const result = await provider.createPayment({
      paymentId,
      purpose: "tip",
      referenceId: tipId,
      amountCents: split.grossCents,
      applicationFeeCents: split.platformGrossFeeCents,
      destinationAccountId,
      description: `Danke an ${driverPublicName(driver, user)} (Lieferdank)`,
      returnUrl: `${baseUrl()}/danke/${driver.code}/erfolg?zahlung=${paymentId}`,
      cancelUrl: `${baseUrl()}/danke/${driver.code}?abgebrochen=1`,
    });
    await db.payments.update(paymentId, { providerPaymentId: result.providerPaymentId, updatedAt: now });
    return { tipId, paymentId, redirectUrl: result.redirectUrl };
  } catch (error) {
    const reason = errorMessage(error);
    await db.payments.update(paymentId, { status: "failed", failureReason: reason, updatedAt: new Date().toISOString() });
    await db.tips.update(tipId, { paymentStatus: "failed" });
    await logEvent("error", "payment", "Zahlung konnte nicht gestartet werden", { paymentId, reason });
    throw new ServiceError(
      "payment_unavailable",
      "Die Zahlung konnte gerade nicht gestartet werden. Danke sagen geht trotzdem.",
      502,
    );
  }
}

/**
 * Bestätigt eine Zahlung – aus dem Webhook oder der Test-Bezahlmaske.
 * Idempotent: Anbieter stellen Ereignisse mehrfach zu.
 */
export async function confirmPayment(
  paymentId: string,
  details: { providerIntentId?: string | null; method?: string | null } = {},
): Promise<Payment | null> {
  const db = getDb();
  const payment = await db.payments.get(paymentId);
  if (!payment) return null;
  if (payment.status === "succeeded") return payment;

  const now = new Date().toISOString();
  await db.payments.update(payment.id, {
    status: "succeeded",
    providerIntentId: details.providerIntentId ?? payment.providerIntentId,
    method: details.method ?? payment.method,
    updatedAt: now,
  });

  if (payment.purpose === "tip") {
    const tip = await db.tips.get(payment.referenceId);
    if (tip) await settleTip(tip, now);
  } else if (payment.purpose === "card_order") {
    await db.cardOrders.update(payment.referenceId, { paymentStatus: "paid", updatedAt: now });
  }
  return { ...payment, status: "succeeded" };
}

async function settleTip(tip: Tip, now: string): Promise<void> {
  const db = getDb();
  await db.tips.update(tip.id, { paymentStatus: "succeeded", payoutStatus: "in_balance" });

  // Jede bezahlte Zahlung ist auch ein Danke – mit Platz für eine Nachricht.
  const existing = await db.thankYous.findOne({ tipId: tip.id });
  if (!existing) {
    await db.thankYous.insert({
      id: newId(),
      driverId: tip.driverId,
      tipId: tip.id,
      customerId: tip.customerId,
      presetId: null,
      message: null,
      createdAt: now,
    });
  }

  await refreshMilestones(tip.driverId);

  const driver = await db.driverProfiles.get(tip.driverId);
  const user = driver ? await db.users.get(driver.userId) : null;
  if (driver?.notifyOnTip && user) {
    await sendMail(
      user.email,
      emails.tipReceived(user.firstName, tip.driverCents, tip.grossCents, `${baseUrl()}/dashboard/danke`),
      "tip_received",
    );
  }
}

export async function failPayment(paymentId: string, reason: string): Promise<void> {
  const db = getDb();
  const payment = await db.payments.get(paymentId);
  if (!payment || payment.status !== "pending") return;
  const now = new Date().toISOString();
  await db.payments.update(payment.id, { status: "failed", failureReason: reason, updatedAt: now });
  if (payment.purpose === "tip") await db.tips.update(payment.referenceId, { paymentStatus: "failed" });
}

export async function markRefunded(providerIntentId: string): Promise<void> {
  const db = getDb();
  const payment = await db.payments.findOne({ providerIntentId });
  if (!payment) return;
  const now = new Date().toISOString();
  await db.payments.update(payment.id, { status: "refunded", updatedAt: now });
  if (payment.purpose === "tip") {
    await db.tips.update(payment.referenceId, { paymentStatus: "refunded" });
    await logEvent("warning", "payment", "Trinkgeld wurde erstattet", { paymentId: payment.id });
  }
}

/** Optionale Nachricht nach einem Danke. Eine einmal gesendete Nachricht bleibt stehen. */
export async function attachMessage(thankYouId: string, presetId: string | null, message: string | null): Promise<void> {
  const db = getDb();
  const thankYou = await db.thankYous.get(thankYouId);
  if (!thankYou) throw notFound("Nachricht konnte nicht zugeordnet werden.");
  if (thankYou.presetId || thankYou.message) return;

  const preset = presetById(presetId);
  const trimmed = (message ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CUSTOM_MESSAGE_LENGTH);
  if (!preset && !trimmed) return;

  await db.thankYous.update(thankYou.id, { presetId: preset?.id ?? null, message: trimmed || null });
}

/** Zustand einer Zahlung für die Erfolgsseite. */
export async function paymentOutcome(paymentId: string, driverId: string) {
  const db = getDb();
  const payment = await db.payments.get(paymentId);
  if (!payment || payment.purpose !== "tip") return null;
  const tip = await db.tips.get(payment.referenceId);
  if (!tip || tip.driverId !== driverId) return null;
  const thankYou = payment.status === "succeeded" ? await db.thankYous.findOne({ tipId: tip.id }) : null;
  return { status: payment.status, grossCents: tip.grossCents, thankYouId: thankYou?.id ?? null };
}
