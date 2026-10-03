import "server-only";
import { getDb } from "@/lib/db";
import type { Payment, Tip, User } from "@/lib/db/types";
import { formatEuro } from "@/lib/format";
import { proportionalFeeRefundCents } from "@/lib/money";
import { ServiceError } from "../errors";
import { errorMessage, logEvent } from "../events";
import { paymentProviderById, type RefundState } from "../payments";
import { logAdminAction } from "./admin";
import { emails } from "../emails";
import { sendMail } from "../mail";
import { baseUrl } from "../site";

/**
 * Erstattungen von Trinkgeldern.
 *
 * Der Zusteller ist Zahlungsempfänger: Stripe erstattet aus seinem Guthaben. Lieferdank hält
 * kein Kundengeld und gibt nur seine Gebühr zurück – vollständig bei vollständiger Erstattung,
 * sonst anteilig zum erstatteten Betrag. Ob die Erstattung hier oder im Stripe-Konto des
 * Zustellers ausgelöst wurde, macht keinen Unterschied: Maßgeblich ist immer der Stand bei
 * Stripe, und der Abgleich holt eine fehlende Gebührenrückgabe nach.
 *
 * Rückbuchungen (Disputes) bewegen hier nie automatisch Geld; sie bleiben im Prüfprozess.
 */

const WRITE_ATTEMPTS = 5;

/** Demo-Zahlungen haben keinen Stripe-Vorgang; dort dient die Zahlungs-ID als Verweis. */
function refundReference(payment: Payment): string | null {
  return payment.providerIntentId ?? (payment.provider === "demo" ? payment.id : null);
}

/** Der Stand bei Stripe muss zur vorgemerkten Zahlung passen – sonst wird nichts verbucht. */
function assertMatches(state: RefundState, payment: Payment, tip: Tip): void {
  const plausible = [state.amountCents, state.refundedCents, state.feeCents, state.feeRefundedCents].every(Number.isSafeInteger) &&
    state.amountCents === payment.amountCents && state.amountCents === tip.grossCents && state.feeCents === tip.platformGrossFeeCents &&
    state.refundedCents >= 0 && state.refundedCents <= state.amountCents &&
    state.feeRefundedCents >= 0 && state.feeRefundedCents <= state.feeCents;
  if (!plausible) throw new Error("Erstattungsstand bei Stripe passt nicht zur vorgemerkten Zahlung.");
}

/**
 * Schreibt den gelesenen Stand. Beträge können nur steigen: ein verspäteter oder paralleler
 * Abgleich mit älterem Stand senkt nichts ab. „Erstattet“ wird ein Trinkgeld erst, wenn der
 * ganze Betrag erstattet UND die ganze Gebühr zurückgegeben ist. Ein Vorgang in Prüfung
 * (Rückbuchung) bleibt in Prüfung.
 */
async function storeRefundState(paymentId: string, tipId: string, state: RefundState): Promise<void> {
  const db = getDb();
  for (let attempt = 0; ; attempt++) {
    const current = await db.tips.get(tipId);
    if (!current) throw new Error("Trinkgeld für den Erstattungsabgleich fehlt.");
    if (current.paymentStatus === "failed") throw new Error("Erstattung zu einer fehlgeschlagenen Zahlung.");
    const refundedCents = Math.max(current.refundedCents ?? 0, state.refundedCents);
    const feeRefundedCents = Math.max(current.feeRefundedCents ?? 0, state.feeRefundedCents);
    const complete = refundedCents === current.grossCents && feeRefundedCents === current.platformGrossFeeCents;
    const paymentStatus = current.paymentStatus === "review_required" ? "review_required" : complete ? "refunded" : current.paymentStatus;
    if (refundedCents === current.refundedCents && feeRefundedCents === current.feeRefundedCents && paymentStatus === current.paymentStatus) break;
    const written = await db.tips.updateIf(current.id, {
      refundedCents: current.refundedCents, feeRefundedCents: current.feeRefundedCents, paymentStatus: current.paymentStatus,
    }, { refundedCents, feeRefundedCents, paymentStatus });
    if (written) break;
    if (attempt >= WRITE_ATTEMPTS) throw new Error("Erstattung konnte nicht verbucht werden.");
  }

  const tip = await db.tips.get(tipId);
  if (!tip) throw new Error("Trinkgeld für den Erstattungsabgleich fehlt.");
  for (let attempt = 0; ; attempt++) {
    const current = await db.payments.get(paymentId);
    if (!current) throw new Error("Zahlung für den Erstattungsabgleich fehlt.");
    if (current.status === "failed") throw new Error("Erstattung zu einer fehlgeschlagenen Zahlung.");
    const refundedAmountCents = Math.max(current.refundedAmountCents ?? 0, tip.refundedCents ?? 0);
    const status = current.status === "review_required" ? "review_required" : tip.paymentStatus === "refunded" ? "refunded" : current.status;
    if (refundedAmountCents === current.refundedAmountCents && status === current.status) break;
    const written = await db.payments.updateIf(current.id, { status: current.status, refundedAmountCents: current.refundedAmountCents }, {
      status, refundedAmountCents, failureReason: status === "refunded" ? null : current.failureReason, updatedAt: new Date().toISOString(),
    });
    if (written) break;
    if (attempt >= WRITE_ATTEMPTS) throw new Error("Erstattung konnte nicht verbucht werden.");
  }
}

/**
 * Gleicht ein Trinkgeld mit dem Erstattungsstand bei Stripe ab und gibt den noch fehlenden
 * Anteil der Lieferdank-Gebühr zurück. Beliebig oft und parallel aufrufbar: Jeder Lauf liest
 * den Stand neu, und Stripe führt eine Gebührenrückgabe pro gelesenem Stand höchstens einmal aus.
 */
export async function reconcileTipRefund(paymentId: string, providerIntentId?: string): Promise<{ tip: Tip; state: RefundState }> {
  const db = getDb();
  let payment = await db.payments.get(paymentId);
  if (!payment || payment.purpose !== "tip") throw new Error("Trinkgeldzahlung für den Erstattungsabgleich fehlt.");
  const tip = await db.tips.get(payment.referenceId);
  if (!tip || tip.paymentId !== payment.id) throw new Error("Trinkgeld für den Erstattungsabgleich fehlt.");

  // Eine Erstattung kann vor der Zahlungsbestätigung eintreffen; dann fehlt der Stripe-Vorgang noch.
  if (providerIntentId) {
    if (!payment.providerIntentId) {
      await db.payments.updateIf(payment.id, { providerIntentId: null }, { providerIntentId });
      payment = (await db.payments.get(payment.id)) ?? payment;
    }
    if (payment.providerIntentId !== providerIntentId) throw new Error("Erstattung gehört zu einer anderen Zahlung.");
  }
  const reference = refundReference(payment);
  if (!reference) throw new Error("Zahlung ohne Stripe-Vorgang kann nicht abgeglichen werden.");

  const provider = paymentProviderById(payment.provider);
  let state = await provider.refundState(reference);
  assertMatches(state, payment, tip);
  // Erst den tatsächlichen Stand festhalten – auch wenn die Gebührenrückgabe gleich scheitert.
  await storeRefundState(payment.id, tip.id, state);

  const inReview = state.disputed || (await db.tips.get(tip.id))?.paymentStatus === "review_required";
  const target = proportionalFeeRefundCents(state.feeCents, state.amountCents, state.refundedCents);
  if (!inReview && state.feeRefundedCents < target) {
    try {
      if (!state.feeReference) throw new Error("Gebühr bei Stripe noch nicht verfügbar.");
      await provider.refundPlatformFee({
        paymentId: payment.id, feeReference: state.feeReference,
        amountCents: target - state.feeRefundedCents, alreadyRefundedCents: state.feeRefundedCents,
      });
    } catch (error) {
      await logEvent("error", "refund", "Lieferdank-Gebühr konnte nicht zurückgegeben werden – Abgleich wird wiederholt", {
        paymentId: payment.id, missingCents: target - state.feeRefundedCents, error: errorMessage(error),
      });
      throw error;
    }
    // Nicht rechnen, sondern lesen: was Stripe jetzt als zurückgegeben führt, wird verbucht.
    state = await provider.refundState(reference);
    assertMatches(state, payment, tip);
    await storeRefundState(payment.id, tip.id, state);
  }
  return { tip: (await db.tips.get(tip.id)) ?? tip, state };
}

const NOT_REFUNDABLE: Record<Payment["status"], string> = {
  pending: "Diese Zahlung ist noch nicht abgeschlossen.",
  failed: "Diese Zahlung ist fehlgeschlagen – es gibt nichts zu erstatten.",
  refunded: "Dieses Trinkgeld ist bereits vollständig erstattet.",
  review_required: "Diese Zahlung ist in Prüfung. Bitte kläre sie direkt in Stripe.",
  succeeded: "",
};

export type TipRefundRequest = {
  /** null = der gesamte noch nicht erstattete Betrag. */
  amountCents: number | null;
  /** Der Erstattungsstand, den der Admin gesehen und bestätigt hat. */
  expectedRefundedCents: number;
  reason: string;
};

/**
 * Löst eine Erstattung aus (nur Admin). Erstattet wird über Stripe aus dem Guthaben des
 * Zustellers; Lieferdank gibt seinen Anteil der Gebühr mit zurück.
 *
 * Gegen Doppel-Erstattung: Der Auftrag gilt für genau den bestätigten Erstattungsstand. Hat der
 * sich geändert, wird abgelehnt; zu jedem Stand führt Stripe höchstens eine Erstattung aus.
 */
export async function refundTip(actor: User, tipId: string, request: TipRefundRequest): Promise<Tip> {
  if (actor.role !== "admin" || actor.blockedAt) throw new ServiceError("forbidden", "Nur für Administratoren.", 403);
  const reason = request.reason.trim();
  if (!reason) throw new ServiceError("reason_required", "Bitte gib einen Grund an – er wird protokolliert.", 400);
  if (!Number.isSafeInteger(request.expectedRefundedCents) || request.expectedRefundedCents < 0 ||
      (request.amountCents !== null && (!Number.isSafeInteger(request.amountCents) || request.amountCents <= 0))) {
    throw new ServiceError("invalid_amount", "Bitte gib einen gültigen Betrag an.", 400, "amount");
  }

  const db = getDb();
  const tip = await db.tips.get(tipId);
  const payment = tip ? await db.payments.get(tip.paymentId) : null;
  if (!tip || !payment || payment.purpose !== "tip" || payment.referenceId !== tip.id) {
    throw new ServiceError("not_found", "Trinkgeld nicht gefunden.", 404);
  }
  if (payment.status !== "succeeded") throw new ServiceError("not_refundable", NOT_REFUNDABLE[payment.status], 409);
  const reference = refundReference(payment);
  if (!reference) throw new ServiceError("not_refundable", "Zu dieser Zahlung fehlt der Stripe-Vorgang.", 409);

  const provider = paymentProviderById(payment.provider);
  let state: RefundState;
  try {
    state = await provider.refundState(reference);
    assertMatches(state, payment, tip);
  } catch (error) {
    await logEvent("error", "refund", "Erstattungsstand bei Stripe nicht lesbar – nichts erstattet", { paymentId: payment.id, error: errorMessage(error) });
    throw new ServiceError("refund_unavailable", "Der Stand bei Stripe konnte nicht gelesen werden. Es wurde nichts erstattet.", 502);
  }
  if (state.disputed) throw new ServiceError("disputed", "Zu dieser Zahlung läuft eine Rückbuchung. Bitte kläre sie direkt in Stripe.", 409);
  if (state.refundedCents !== request.expectedRefundedCents) {
    // Den neuen Stand gleich verbuchen, damit die Seite nach dem Neuladen stimmt.
    await reconcileTipRefund(payment.id).catch(() => undefined);
    throw new ServiceError("stale", "Der Erstattungsstand hat sich geändert. Bitte lade die Seite neu und prüfe die Beträge.", 409);
  }
  const remaining = state.amountCents - state.refundedCents;
  const amount = request.amountCents ?? remaining;
  if (amount <= 0 || amount > remaining) {
    throw new ServiceError("invalid_amount", `Erstattet werden können höchstens ${formatEuro(remaining)}.`, 400, "amount");
  }

  // Vor der Geldbewegung protokollieren: scheitert das Protokoll, wird nichts erstattet.
  await logAdminAction(actor, tip.id, "tip_refund_requested",
    `${amount} von ${state.amountCents} Cent, bereits erstattet ${state.refundedCents}: ${reason.slice(0, 250)}`);
  try {
    await provider.refundPayment({ providerIntentId: reference, amountCents: amount, expectedRefundedCents: state.refundedCents });
  } catch (error) {
    await logEvent("error", "refund", "Erstattung von Stripe nicht bestätigt", { paymentId: payment.id, amountCents: amount, error: errorMessage(error) });
    throw new ServiceError("refund_failed",
      "Stripe hat die Erstattung nicht bestätigt. Bitte lade die Seite neu und prüfe den Stand, bevor du es erneut versuchst.", 502);
  }
  // Die AGB sagen dem Zusteller zu, dass er über jede von Lieferdank ausgelöste Erstattung informiert wird.
  await notifyDriverOfRefund(tip, state.refundedCents + amount, reason);
  try {
    return (await reconcileTipRefund(payment.id)).tip;
  } catch (error) {
    await logEvent("warning", "refund", "Erstattung ausgelöst, Verbuchung folgt über den Webhook", { paymentId: payment.id, error: errorMessage(error) });
    throw new ServiceError("refund_sync_pending",
      "Die Erstattung wurde bei Stripe ausgelöst, ist hier aber noch nicht verbucht. Der Abgleich folgt automatisch – bitte lade die Seite gleich neu.", 502);
  }
}

async function notifyDriverOfRefund(tip: Tip, refundedCents: number, reason: string): Promise<void> {
  try {
    const db = getDb();
    const driver = await db.driverProfiles.get(tip.driverId);
    const user = driver ? await db.users.get(driver.userId) : null;
    if (!user || user.blockedAt) return;
    await sendMail(user.email, emails.refundNotice(user.firstName, refundedCents, tip.grossCents, reason.slice(0, 250), `${baseUrl()}/dashboard/einnahmen`), "refund_notice");
  } catch (error) {
    await logEvent("warning", "refund", "Zusteller konnte nicht über die Erstattung informiert werden", { tipId: tip.id, error: errorMessage(error) });
  }
}
