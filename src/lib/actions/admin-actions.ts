"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { generateLieferdankCode, newId } from "@/lib/id";
import { getPaymentProvider } from "@/lib/payments";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return session;
}

async function log(actorEmail: string, targetId: string, action: string, reason?: string) {
  await getStore().createAdminAction({
    id: newId(),
    actorEmail,
    targetId,
    action,
    reason: reason ?? null,
    createdAt: new Date().toISOString(),
  });
}

export async function reviewVerification(
  driverId: string,
  decision: "verified" | "rejected",
  reviewNote: string,
): Promise<void> {
  const { user } = await requireAdmin();
  const store = getStore();
  const driver = await store.getDriverById(driverId);
  if (!driver) return;

  await store.updateDriverProfile(driver.id, { verification: decision });

  const existing = await store.getVerificationByUserId(driver.userId);
  await store.upsertVerification({
    id: existing?.id ?? newId(),
    userId: driver.userId,
    identityStatus: decision,
    driverStatus: decision,
    documentNote: existing?.documentNote ?? null,
    reviewNote: reviewNote.trim() || null,
    updatedAt: new Date().toISOString(),
  });

  await log(user.email, driver.id, `verification_${decision}`, reviewNote.trim() || undefined);
  revalidatePath("/admin");
}

/** Bestaetigt, dass die Anbieterangabe geprueft wurde (§19). */
export async function setProviderVerified(driverId: string, verified: boolean): Promise<void> {
  const { user } = await requireAdmin();
  await getStore().updateDriverProfile(driverId, { providerVerified: verified });
  await log(user.email, driverId, verified ? "provider_verified" : "provider_unverified");
  revalidatePath("/admin");
}

export async function setUserBlocked(
  userId: string,
  blocked: boolean,
  reason: string,
): Promise<void> {
  const { user } = await requireAdmin();
  if (user.id === userId) return; // Kein Selbst-Sperren.

  await getStore().updateUser(userId, {
    blockedAt: blocked ? new Date().toISOString() : null,
    blockedReason: blocked ? reason.trim() || "Ohne Angabe" : null,
  });
  await log(user.email, userId, blocked ? "user_blocked" : "user_unblocked", reason);
  revalidatePath("/admin");
}

/** Erzeugt einen neuen Code, z. B. nach Diebstahl oder Missbrauch einer Karte (§46). */
export async function regenerateCode(driverId: string): Promise<void> {
  const { user } = await requireAdmin();
  const store = getStore();

  let code = generateLieferdankCode();
  for (let attempt = 0; attempt < 12 && (await store.getDriverByCode(code)); attempt++) {
    code = generateLieferdankCode(attempt < 8 ? 5 : 6);
  }

  await store.updateDriverProfile(driverId, { code });
  await log(user.email, driverId, "code_regenerated", `Neuer Code: ${code}`);
  revalidatePath("/admin");
}

/**
 * Zahlt das offene Guthaben eines Zustellers aus.
 *
 * Zwei Faelle, die sauber getrennt werden muessen:
 *  - Zahlungen MIT Zielkonto: Der Anteil ist bereits beim Zusteller gelandet.
 *    Hier wird nur gebucht, sonst wuerde doppelt gezahlt.
 *  - Zahlungen OHNE Zielkonto (eingegangen, bevor das Konto bereit war):
 *    Die Plattform haelt das Geld und muss es aktiv ueberweisen.
 *
 * Schlaegt die Ueberweisung fehl, wird nichts als ausgezahlt markiert.
 */
export async function markPaidOut(driverId: string): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requireAdmin();
  const store = getStore();

  const driver = await store.getDriverById(driverId);
  if (!driver) return { ok: false, error: "Zusteller nicht gefunden." };

  const tips = await store.listTipsByDriver(driverId);
  const open = tips.filter(
    (tip) => tip.paymentStatus === "succeeded" && tip.payoutStatus !== "paid_out",
  );
  if (open.length === 0) return { ok: true };

  const heldByPlatform = open.filter((tip) => !tip.destinationAccountId);
  const owedCents = heldByPlatform.reduce((sum, tip) => sum + tip.driverCents, 0);

  if (owedCents > 0) {
    if (!driver.payoutAccountId || !driver.payoutReady) {
      return {
        ok: false,
        error:
          "Der Zusteller hat noch kein einsatzbereites Auszahlungskonto. Ohne Konto kann nicht überwiesen werden.",
      };
    }
    try {
      await getPaymentProvider().createPayout({
        accountId: driver.payoutAccountId,
        amountCents: owedCents,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      await log(user.email, driverId, "payout_failed", message);
      revalidatePath("/admin");
      return { ok: false, error: `Überweisung fehlgeschlagen: ${message}` };
    }
  }

  for (const tip of open) {
    await store.updateTip(tip.id, { payoutStatus: "paid_out" });
  }

  const total = open.reduce((sum, tip) => sum + tip.driverCents, 0);
  await log(
    user.email,
    driverId,
    "payout_marked",
    `${open.length} Zahlungen, ${total} Cent gesamt, davon ${owedCents} Cent überwiesen`,
  );
  revalidatePath("/admin");
  return { ok: true };
}
