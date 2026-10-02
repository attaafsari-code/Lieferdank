import "server-only";
import { getDb } from "@/lib/db";
import type { DriverProfile, User } from "@/lib/db/types";
import { ServiceError } from "../errors";
import { getPaymentProvider } from "../payments";
import { baseUrl } from "../site";
import { thankYouUrl } from "../qr";

/* ---------- Auszahlungskonto ---------- */

const PAYOUT_RETURN_PATH = "/dashboard/einnahmen?konto=fertig";

/**
 * Startet die Einrichtung beim Zahlungsdienstleister. Dort passiert auch die Identitätsprüfung (KYC).
 * Liefert die Adresse, zu der weitergeleitet wird: Stripe oder – bei fertigem Konto – die Einnahmen-Seite.
 */
export async function startPayoutOnboarding(user: User, driver: DriverProfile): Promise<string> {
  if (user.role !== "driver" || driver.userId !== user.id) {
    throw new ServiceError("forbidden", "Dieses Auszahlungskonto gehört nicht zu deinem Profil.", 403);
  }
  const provider = getPaymentProvider();
  let accountId = driver.payoutAccountId;
  if (accountId) {
    // Ein fertiges Standard-Konto verwaltet der Lieferant in seinem eigenen Stripe-Dashboard.
    // Hosted Onboarding ist nur für fehlende Angaben da, kein allgemeiner Bearbeiten-Flow.
    // Schlägt die Prüfung fehl, entscheidet onboardDriver (Support-Hinweis bzw. Störung).
    const existing = accountId;
    const ready = await syncPayoutReadiness(driver.id, () => provider.isAccountReady(existing, driver.id)).catch(() => null);
    if (ready) return PAYOUT_RETURN_PATH;
  } else {
    accountId = await provider.createConnectedAccount({
      email: user.email,
      driverId: driver.id,
      profileUrl: thankYouUrl(driver.code),
    });
    await getDb().driverProfiles.update(driver.id, { payoutAccountId: accountId, updatedAt: new Date().toISOString() });
  }
  const link = await provider.onboardDriver({
    accountId,
    driverId: driver.id,
    returnUrl: `${baseUrl()}${PAYOUT_RETURN_PATH}`,
    refreshUrl: `${baseUrl()}/dashboard/einnahmen?konto=neu`,
  });
  return link.url;
}

/** Für den Hinweis im Dashboard. Bei Stripe-Störungen lieber kein Hinweis als ein falscher. */
export async function payoutsAreManual(driver: DriverProfile): Promise<boolean> {
  if (!driver.payoutAccountId) return false;
  try {
    return (await getPaymentProvider().payoutInterval(driver.payoutAccountId)) === "manual";
  } catch {
    return false;
  }
}

/**
 * "unverified": Stripe war nicht abfragbar – weder Erfolg noch „in Prüfung“ behaupten.
 * "none": es gibt kein Stripe-Konto, also auch nichts, was Stripe prüfen könnte.
 */
export type PayoutReturn = { ready: boolean; notice: "ready" | "pending" | "unverified" | "none" };

/**
 * Rückkehr von Stripe: es zählt der Live-Status – auch wenn das Konto vorher schon
 * bereit war. Schlägt die Abfrage fehl, bleibt der gespeicherte Stand gültig, gilt
 * aber nicht als gerade bestätigt.
 */
export async function payoutReadinessAfterReturn(driver: DriverProfile): Promise<PayoutReturn> {
  if (!driver.payoutAccountId) return { ready: false, notice: "none" };
  try {
    const ready = await refreshPayoutReadiness(driver);
    return { ready, notice: ready ? "ready" : "pending" };
  } catch {
    return { ready: driver.payoutReady, notice: "unverified" };
  }
}

export async function refreshPayoutReadiness(driver: DriverProfile): Promise<boolean> {
  const accountId = driver.payoutAccountId;
  if (!accountId) return false;
  return syncPayoutReadiness(driver.id, () => getPaymentProvider().isAccountReady(accountId, driver.id));
}

const SYNC_ATTEMPTS = 3;

/**
 * Einziger Weg, payoutReady aus einem Stripe-Abruf zu speichern. Webhooks und Dashboard
 * können denselben Abgleich parallel ausführen; Stripe liefert dafür keine Reihenfolge
 * (das Konto hat keinen Änderungsstempel, Ereignisse nur Sekundenauflösung).
 *
 * Deshalb: Version lesen → Stripe lesen → in EINER Anweisung nur dann schreiben, wenn die
 * Version noch dieselbe ist, und sie dabei erhöhen. Wer erfolgreich schreibt, hat Stripe
 * nach dem letzten erfolgreichen Abgleich abgefragt – ein älterer Abruf kann nichts Neueres
 * überschreiben. payoutSyncVersion ist eine Ganzzahl und gehört nur diesem Abgleich:
 * andere Profiländerungen berühren sie nicht, und es gibt kein Genauigkeitsproblem wie bei
 * Zeitstempeln. Bei einem Konflikt wird mit frischem Abruf wiederholt; reicht das nicht,
 * wirft die Funktion (Webhook → 500 → Stripe stellt erneut zu), ohne etwas zu schreiben.
 */
export async function syncPayoutReadiness(driverId: string, readLive: () => Promise<boolean>): Promise<boolean> {
  const drivers = getDb().driverProfiles;
  for (let attempt = 0; attempt < SYNC_ATTEMPTS; attempt++) {
    const before = await drivers.get(driverId);
    if (!before) throw new Error("Lieferantenprofil für den Kontoabgleich fehlt.");
    const version = before.payoutSyncVersion;
    if (!Number.isInteger(version)) {
      throw new Error("driver_profiles.payout_sync_version fehlt – Migration 20261002_payout_sync_version.sql ausführen.");
    }
    const ready = await readLive();
    const written = await drivers.updateIf(driverId, { payoutSyncVersion: version }, {
      payoutReady: ready, payoutSyncVersion: version + 1, updatedAt: new Date().toISOString(),
    });
    if (written) return ready;
  }
  throw new Error("Kontostatus wurde parallel abgeglichen – Abgleich nicht abgeschlossen.");
}
