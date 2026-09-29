import "server-only";
import { getDb, isDemoDatabase } from "@/lib/db";
import type { Payment, Tip } from "@/lib/db/types";
import { newId } from "@/lib/id";
import { CURRENCY, isAllowedTipAmount, splitTip } from "@/lib/money";
import { isProductionRuntime } from "@/lib/runtime";
import { MAX_CUSTOM_MESSAGE_LENGTH, presetById } from "@/lib/messages";
import { ServiceError, notFound } from "../errors";
import { getPaymentProvider, isDemoPayment } from "../payments";
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
  if (isProductionRuntime() && isDemoPayment()) {
    throw new ServiceError("payment_not_configured", "Trinkgeld ist gerade nicht verfügbar. Danke sagen geht weiterhin kostenlos.", 503);
  }
  if (process.env.VERCEL_ENV === "preview" && !isDemoPayment() &&
      /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "")) {
    throw new ServiceError("payment_not_configured", "Trinkgeld ist in dieser Vorschau deaktiviert.", 503);
  }
  if (isDemoPayment() && !isDemoDatabase() &&
      process.env.ALLOW_DEMO_SUPABASE_TEST_PROJECT !== "true") {
    throw new ServiceError("payment_not_configured", "Testzahlungen benötigen ein getrenntes Testprojekt.", 503);
  }
  if (!isAllowedTipAmount(amountCents)) {
    throw new ServiceError(
      "invalid_amount",
      "Möglich sind 2 €, 3 € oder 5 €.",
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
  // Niemals Fahrergeld auf dem Plattformkonto halten. Stripe-Status live prüfen.
  // Demo ist ausschließlich in isolierten Testumgebungen erlaubt.
  let destinationAccountId: string;
  if (provider.id === "demo") {
    destinationAccountId = `demo_acct_${driver.id.slice(0, 8)}`;
  } else {
    if (!driver.payoutAccountId) {
      throw new ServiceError("connect_required", "Dieser Zusteller kann noch kein Trinkgeld empfangen. Kostenlos Danke sagen geht weiterhin.", 409);
    }
    let ready = false;
    try { ready = await provider.isAccountReady(driver.payoutAccountId, driver.id); } catch {
      throw new ServiceError("connect_unavailable", "Trinkgeld ist gerade nicht verfügbar. Kostenlos Danke sagen geht weiterhin.", 503);
    }
    if (!ready) {
      throw new ServiceError("connect_required", "Dieser Zusteller muss seine Stripe-Einrichtung abschließen. Kostenlos Danke sagen geht weiterhin.", 409);
    }
    destinationAccountId = driver.payoutAccountId;
  }

  await db.payments.insert({
    id: paymentId,
    purpose: "tip",
    referenceId: tipId,
    provider: provider.id,
    providerPaymentId: null,
    providerIntentId: null,
    amountCents: split.grossCents,
    refundedAmountCents: 0,
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
      driverId: driver.id,
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
  if (payment.status === "refunded" || payment.status === "review_required") return payment;

  const now = new Date().toISOString();
  if (payment.status !== "succeeded") {
    const changed = await db.payments.updateIf(payment.id, { status: payment.status }, {
      status: "succeeded",
      providerIntentId: details.providerIntentId ?? payment.providerIntentId,
      method: details.method ?? payment.method,
      updatedAt: now,
    });
    if (!changed) return confirmPayment(paymentId, details);
  }

  if (payment.purpose === "tip") {
    const tip = await db.tips.get(payment.referenceId);
    if (tip) await settleTip(tip, now);
  } else if (payment.purpose === "card_order") {
    const order = await db.cardOrders.get(payment.referenceId);
    if (order?.status === "cancelled") {
      await markPaymentAdjustment(details.providerIntentId ?? payment.providerIntentId ?? "", payment.id, "cancelled_order");
      return (await db.payments.get(payment.id)) ?? payment;
    }
    for (const expected of ["pending", "failed"] as const) {
      await db.cardOrders.updateIf(payment.referenceId, { paymentStatus: expected }, { paymentStatus: "paid", updatedAt: now });
    }
    const currentStatus = (await db.payments.get(payment.id))?.status;
    if (currentStatus === "refunded" || currentStatus === "review_required") {
      await db.cardOrders.updateIf(payment.referenceId, { paymentStatus: "paid" }, { paymentStatus: currentStatus, updatedAt: now });
    }
  }
  return { ...payment, status: "succeeded" };
}

async function settleTip(tip: Tip, now: string): Promise<void> {
  const db = getDb();
  if (tip.paymentStatus === "refunded" || tip.paymentStatus === "review_required") return;
  const newlySettled = tip.paymentStatus !== "succeeded" && await db.tips.updateIf(
    tip.id, { paymentStatus: tip.paymentStatus }, { paymentStatus: "succeeded", payoutStatus: "in_balance" },
  );
  if (tip.paymentStatus !== "succeeded" && !newlySettled) return;

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

  // Auch ein Retry nach einem Absturz zwischen Buchung und Meilenstein heilt
  // den Zwischenzustand; die Meilensteine sind per DB eindeutig.
  await refreshMilestones(tip.driverId);

  const driver = await db.driverProfiles.get(tip.driverId);
  const user = driver ? await db.users.get(driver.userId) : null;
  if (newlySettled && driver?.notifyOnTip && user) {
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
  if (!await db.payments.updateIf(payment.id, { status: "pending" }, { status: "failed", failureReason: reason, updatedAt: now })) return;
  if (payment.purpose === "tip") await db.tips.updateIf(payment.referenceId, { paymentStatus: "pending" }, { paymentStatus: "failed" });
  if (payment.purpose === "card_order") await db.cardOrders.updateIf(payment.referenceId, { paymentStatus: "pending" }, { paymentStatus: "failed", updatedAt: now });
}

export async function markRefunded(
  providerIntentId: string,
  fallbackPaymentId?: string,
  amountRefundedCents?: number,
): Promise<void> {
  await markPaymentAdjustment(providerIntentId, fallbackPaymentId, "refund", amountRefundedCents);
}

/** Disputes remain excluded from earnings until an operator checks the Stripe outcome. */
export async function markDisputed(providerIntentId: string, fallbackPaymentId?: string): Promise<void> {
  await markPaymentAdjustment(providerIntentId, fallbackPaymentId, "dispute");
}

async function markPaymentAdjustment(
  providerIntentId: string,
  fallbackPaymentId: string | undefined,
  kind: "refund" | "dispute" | "cancelled_order",
  amountRefundedCents?: number,
): Promise<void> {
  const db = getDb();
  const payment = (providerIntentId ? await db.payments.findOne({ providerIntentId }) : null) ??
    (fallbackPaymentId ? await db.payments.get(fallbackPaymentId) : null);
  if (!payment) throw new Error("Zahlung für Stripe-Korrektur fehlt.");
  if (providerIntentId && payment.providerIntentId && payment.providerIntentId !== providerIntentId) {
    throw new Error("Erstattung gehört zu einer anderen Zahlung.");
  }
  if (amountRefundedCents !== undefined &&
      (!Number.isSafeInteger(amountRefundedCents) || amountRefundedCents < 0 || amountRefundedCents > payment.amountCents)) {
    throw new Error("Ungültiger Erstattungsbetrag.");
  }
  if (kind === "refund" && amountRefundedCents === 0) return;

  const tip = payment.purpose === "tip" ? await db.tips.get(payment.referenceId) : null;
  const order = payment.purpose === "card_order" ? await db.cardOrders.get(payment.referenceId) : null;
  if (payment.purpose === "tip" && !tip) throw new Error("Trinkgeld für Stripe-Korrektur fehlt.");
  if (payment.purpose === "card_order" && !order) throw new Error("Kartenbestellung für Stripe-Korrektur fehlt.");
  // Direct Charges liegen bei Stripe auf dem Connected Account. Jede Erstattung
  // muss dort und bezüglich der Application Fee nachvollzogen werden.
  const transferred = Boolean(tip?.destinationAccountId || tip?.payoutStatus === "paid_out");
  const shipped = Boolean(order && ["in_production", "shipped", "delivered"].includes(order.status));
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await db.payments.get(payment.id);
    if (!current) throw new Error("Zahlung für Erstattung fehlt.");
    if (providerIntentId && current.providerIntentId && current.providerIntentId !== providerIntentId) {
      throw new Error("Erstattung gehört zu einer anderen Zahlung.");
    }
    const previousRefunded = current.refundedAmountCents ?? 0;
    const refundedAmountCents = kind === "refund"
      ? Math.max(previousRefunded, amountRefundedCents ?? current.amountCents)
      : previousRefunded;
    const partial = kind === "refund" && refundedAmountCents < current.amountCents;
    const requestedStatus = kind !== "refund" || partial || transferred || shipped ? "review_required" : "refunded";
    const nextStatus = current.status === "review_required" ? "review_required" : requestedStatus;
    const reason = kind === "dispute" ? "Stripe-Streitfall: manuelle Abstimmung erforderlich" :
      kind === "cancelled_order" ? "Zahlung nach stornierter Kartenbestellung: manuelle Abstimmung erforderlich" :
      partial ? `Teil-Erstattung ${refundedAmountCents}/${current.amountCents} Cent: manuelle Abstimmung erforderlich` :
        transferred ? "Direct-Charge-Erstattung: Abgleich von Application Fee und Stripe-Status erforderlich" :
          shipped ? "Erstattung nach Kartenproduktion: manuelle Abstimmung erforderlich" : null;
    if (current.status === nextStatus && previousRefunded === refundedAmountCents && current.refundedAmountCents !== undefined) break;
    if (await db.payments.updateIf(current.id, {
      status: current.status,
      ...(current.refundedAmountCents === undefined ? {} : { refundedAmountCents: current.refundedAmountCents }),
    }, {
      status: nextStatus, providerIntentId: providerIntentId || current.providerIntentId,
      refundedAmountCents,
      failureReason: nextStatus === "review_required"
        ? (current.failureReason?.startsWith("Stripe-Streitfall") ? current.failureReason : reason ?? current.failureReason ?? "Manueller Stripe-Abgleich erforderlich")
        : null,
      updatedAt: now,
    })) break;
  }
  const finalStatus = (await db.payments.get(payment.id))?.status;
  if (finalStatus !== "refunded" && finalStatus !== "review_required") throw new Error("Stripe-Korrektur konnte nicht verbucht werden.");
  if (payment.purpose === "tip") {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await db.tips.get(payment.referenceId);
      if (!current) throw new Error("Trinkgeld für Stripe-Korrektur fehlt.");
      if (current.paymentStatus === finalStatus) break;
      if (await db.tips.updateIf(current.id, { paymentStatus: current.paymentStatus }, { paymentStatus: finalStatus })) break;
    }
    if ((await db.tips.get(payment.referenceId))?.paymentStatus !== finalStatus) throw new Error("Trinkgeld-Korrektur konnte nicht verbucht werden.");
  } else if (payment.purpose === "card_order") {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await db.cardOrders.get(payment.referenceId);
      if (!current || current.paymentStatus === "not_required") throw new Error("Karten-Zahlung für Stripe-Korrektur fehlt.");
      if (current.paymentStatus === finalStatus) break;
      if (await db.cardOrders.updateIf(current.id, { paymentStatus: current.paymentStatus }, {
        paymentStatus: finalStatus, updatedAt: now,
      })) break;
    }
    if ((await db.cardOrders.get(payment.referenceId))?.paymentStatus !== finalStatus) throw new Error("Karten-Korrektur konnte nicht verbucht werden.");
  }
  if (finalStatus === "review_required") {
    await logEvent("error", "payment", "Stripe-Korrektur benötigt manuellen Abgleich", {
      paymentId: payment.id, payoutId: tip?.payoutId ?? null, kind, amountRefundedCents: amountRefundedCents ?? null,
    });
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
