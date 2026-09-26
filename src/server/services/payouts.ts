import "server-only";
import { getDb } from "@/lib/db";
import type { DriverProfile, Payout, User } from "@/lib/db/types";
import { newId } from "@/lib/id";
import { allocateFee, estimatePayoutFeeCents } from "@/lib/money";
import { ServiceError } from "../errors";
import { getPaymentProvider } from "../payments";
import { baseUrl } from "../site";
import { sendMail } from "../mail";
import { emails } from "../emails";
import { errorMessage, logEvent } from "../events";

/* ---------- Auszahlungskonto ---------- */

/** Startet die Einrichtung beim Zahlungsdienstleister. Dort passiert auch die Identitätsprüfung (KYC). */
export async function startPayoutOnboarding(user: User, driver: DriverProfile): Promise<string> {
  const provider = getPaymentProvider();
  let accountId = driver.payoutAccountId;
  if (!accountId) {
    accountId = await provider.createConnectedAccount({ email: user.email, driverId: driver.id });
    await getDb().driverProfiles.update(driver.id, { payoutAccountId: accountId, updatedAt: new Date().toISOString() });
  }
  const link = await provider.onboardDriver({
    accountId,
    returnUrl: `${baseUrl()}/dashboard/einnahmen?konto=fertig`,
    refreshUrl: `${baseUrl()}/dashboard/einnahmen?konto=neu`,
  });
  return link.url;
}

export async function refreshPayoutReadiness(driver: DriverProfile): Promise<boolean> {
  if (!driver.payoutAccountId) return false;
  const ready = await getPaymentProvider().isAccountReady(driver.payoutAccountId);
  await getDb().driverProfiles.update(driver.id, { payoutReady: ready, updatedAt: new Date().toISOString() });
  return ready;
}

/* ---------- Auszahlung ---------- */

/**
 * Zahlt das offene Guthaben eines Zustellers aus.
 *
 *  - Anteile MIT Zielkonto liegen schon beim Zusteller → nur buchen.
 *  - Anteile OHNE Zielkonto hält die Plattform → aktiv überweisen.
 *
 * Die Auszahlungsgebühr wird cent-genau auf die Trinkgelder verteilt und
 * mindert die Netto-Marge. Schlägt die Überweisung fehl, bleibt alles offen.
 */
export async function payoutDriver(driverId: string): Promise<Payout | null> {
  const db = getDb();
  const driver = await db.driverProfiles.get(driverId);
  if (!driver) throw new ServiceError("not_found", "Zusteller nicht gefunden.", 404);

  const open = await db.tips.findMany({ where: { driverId, paymentStatus: "succeeded", payoutStatus: "in_balance" } });
  if (open.length === 0) return null;

  const amountCents = open.reduce((sum, tip) => sum + tip.driverCents, 0);
  const owedCents = open.filter((t) => !t.destinationAccountId).reduce((sum, tip) => sum + tip.driverCents, 0);

  if (owedCents > 0 && (!driver.payoutAccountId || !driver.payoutReady)) {
    throw new ServiceError(
      "payout_account_missing",
      "Der Zusteller hat noch kein einsatzbereites Auszahlungskonto. Ohne Konto kann nicht überwiesen werden.",
      409,
    );
  }

  const provider = getPaymentProvider();
  const now = new Date().toISOString();
  const feeCents = owedCents > 0 ? estimatePayoutFeeCents(owedCents) : 0;
  const payout: Payout = {
    id: newId(),
    driverId,
    amountCents,
    transferredCents: owedCents,
    feeCents,
    status: "pending",
    provider: provider.id,
    providerTransferId: null,
    tipIds: open.map((t) => t.id),
    failureReason: null,
    createdAt: now,
    completedAt: null,
  };
  await db.payouts.insert(payout);

  let transferId: string | null = null;
  if (owedCents > 0) {
    try {
      transferId = await provider.createPayout({ accountId: driver.payoutAccountId!, amountCents: owedCents, payoutId: payout.id });
    } catch (error) {
      const reason = errorMessage(error);
      await db.payouts.update(payout.id, { status: "failed", failureReason: reason, completedAt: new Date().toISOString() });
      await logEvent("error", "payout", "Überweisung fehlgeschlagen", { payoutId: payout.id, driverId, reason });
      throw new ServiceError("payout_failed", `Überweisung fehlgeschlagen: ${reason}`, 502);
    }
  }

  const shares = allocateFee(feeCents, open.length);
  for (const [index, tip] of open.entries()) {
    const payoutFeeCents = shares[index];
    await db.tips.update(tip.id, {
      payoutStatus: "paid_out",
      payoutId: payout.id,
      payoutFeeCents,
      platformNetRevenueCents: tip.platformGrossFeeCents - tip.paymentProviderFeeCents - payoutFeeCents,
    });
  }

  const completedAt = new Date().toISOString();
  await db.payouts.update(payout.id, { status: "paid", providerTransferId: transferId, completedAt });

  const user = await db.users.get(driver.userId);
  if (user) await sendMail(user.email, emails.payoutSent(user.firstName, amountCents, `${baseUrl()}/dashboard/einnahmen`), "payout");

  return { ...payout, status: "paid", providerTransferId: transferId, completedAt };
}
