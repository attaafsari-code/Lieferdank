"use server";

import { redirect } from "next/navigation";
import { getSession } from "../session";
import { enforceRateLimit } from "../rate-limit";
import { isDemoPayment } from "../payments";
import { isServiceError } from "../errors";
import { attachMessage, confirmPayment, failPayment, sendFreeThankYou, startTip } from "../services/thanks";
import { addFavoriteByCode } from "../services/favorites";
import { getDb } from "@/lib/db";
import { isProductionRuntime } from "@/lib/runtime";
import { errorMessage, logEvent } from "../events";
import { visitorId } from "../visitor";

/**
 * Aktionen der Kundenseite. Nie an ein Konto gebunden – ein angemeldeter
 * Kunde wird nur optional vermerkt, damit er seinen Verlauf sehen kann.
 */

export type FlowResult = { ok: boolean; error?: string };

async function customerIdIfAny(): Promise<string | null> {
  const session = await getSession();
  return session?.customer ? session.user.id : null;
}

function toResult(error: unknown): FlowResult {
  if (isServiceError(error)) return { ok: false, error: error.message };
  void logEvent("error", "customer-flow", "Unerwarteter Fehler", { error: errorMessage(error) });
  return { ok: false, error: "Das hat leider nicht geklappt. Bitte versuch es noch einmal." };
}

export async function sendThanksAction(code: string): Promise<FlowResult> {
  let target: string;
  try {
    await enforceRateLimit("thanks", 10, 60_000);
    const result = await sendFreeThankYou(code, await customerIdIfAny(), await visitorId());
    target = `/danke/${result.code}/erfolg?danke=${result.thankYouId}${result.alreadySent ? "&bereits=1" : ""}`;
  } catch (error) {
    return toResult(error);
  }
  redirect(target);
}

export async function startTipAction(code: string, amountCents: number): Promise<FlowResult> {
  let target: string;
  try {
    await enforceRateLimit("tip", 10, 60_000);
    const result = await startTip(code, amountCents, await customerIdIfAny());
    target = result.redirectUrl;
  } catch (error) {
    return toResult(error);
  }
  redirect(target);
}

export async function attachMessageAction(
  thankYouId: string,
  presetId: string | null,
  message: string | null,
): Promise<FlowResult> {
  try {
    await enforceRateLimit("message", 20, 60_000);
    await attachMessage(thankYouId, presetId, message);
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

/** „Lieferant speichern“ – nur für angemeldete Kunden, sonst Hinweis auf ein Konto. */
export async function saveDriverAction(code: string): Promise<FlowResult & { needsAccount?: boolean }> {
  const session = await getSession();
  if (!session?.customer) return { ok: false, needsAccount: true };
  try {
    await enforceRateLimit("favorite", 30, 60_000);
    await addFavoriteByCode(session.user.id, code);
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Test-Bezahlmaske. Existiert ausschließlich im Testmodus – im Echtbetrieb
 * bestätigt allein der signierte Webhook des Zahlungsdienstleisters.
 */
export async function confirmDemoPaymentAction(paymentId: string, succeed: boolean): Promise<void> {
  if (!isDemoPayment() || isProductionRuntime()) throw new Error("Testzahlungen sind deaktiviert.");
  await enforceRateLimit("demo-pay", 20, 60_000);

  const db = getDb();
  const payment = await db.payments.get(paymentId);
  if (!payment) redirect("/");
  if (payment.provider !== "demo") throw new Error("Testzahlungen sind deaktiviert.");

  if (payment.purpose === "card_order") {
    if (succeed) await confirmPayment(paymentId, { method: "demo" });
    else await failPayment(paymentId, "Vom Kunden abgebrochen");
    redirect(`/dashboard/karte/bestellen?${succeed ? "bestellt" : "abgebrochen"}=1`);
  }

  const tip = await db.tips.get(payment.referenceId);
  const driver = tip ? await db.driverProfiles.get(tip.driverId) : null;
  if (!driver) redirect("/");

  if (!succeed) {
    await failPayment(paymentId, "Vom Kunden abgebrochen");
    redirect(`/danke/${driver.code}?abgebrochen=1`);
  }

  await confirmPayment(paymentId, { method: "demo" });
  redirect(`/danke/${driver.code}/erfolg?zahlung=${paymentId}`);
}
