import "server-only";
import { getDb } from "@/lib/db";
import type { DriverProfile, User } from "@/lib/db/types";
import { ServiceError } from "../errors";
import { errorMessage, logEvent } from "../events";
import { getPaymentProvider } from "../payments";
import { baseUrl } from "../site";
import { thankYouUrl } from "../qr";
import { assertEmailVerified } from "./auth";
import { formatReceivedAt } from "./legal-requests";
import { emails } from "../emails";
import { sendMail } from "../mail";
import { newId } from "@/lib/id";

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
  // Stripe legt das Konto mit dieser Adresse an – sie muss nachweislich dem Lieferanten gehören.
  assertEmailVerified(user);
  const provider = getPaymentProvider();
  const createAccount = () => provider.createConnectedAccount({
    email: user.email,
    driverId: driver.id,
    profileUrl: thankYouUrl(driver.code),
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
  });
  let accountId = driver.payoutAccountId;
  if (accountId) {
    // Ein fertiges Standard-Konto verwaltet der Lieferant in seinem eigenen Stripe-Dashboard.
    // Hosted Onboarding ist nur für fehlende Angaben da, kein allgemeiner Bearbeiten-Flow.
    // Schlägt die Prüfung fehl, entscheidet onboardDriver (Support-Hinweis bzw. Störung).
    const existing = accountId;
    const ready = await syncPayoutReadiness(driver.id, () => provider.isAccountReady(existing, driver.id)).catch(() => null);
    if (ready) return PAYOUT_RETURN_PATH;
    // Nur wenn Stripe gerade sicher „nicht bereit“ gemeldet hat, kommt ein Tausch überhaupt in Frage.
    if (ready === false) accountId = await replaceLegacyAccount(driver.id, existing, createAccount);
  } else {
    accountId = await createAccount();
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

/**
 * Konten aus der Zeit vor der Vorbelegung verlangen vom Lieferanten Branche, Website und
 * Beschreibung – und Stripe lässt die Plattform das nach dem ersten Onboarding-Link nicht
 * mehr nachtragen. Ist ein solches Konto noch völlig unberührt, bekommt der Lieferant
 * stattdessen ein neues, vorbelegtes. Das alte wird weder gelöscht noch verändert.
 *
 * Defensiv: Jeder Zweifel und jeder Stripe-Fehler bei der Prüfung heißt „Konto behalten“.
 * Scheitert die Anlage des Ersatzkontos, bleibt die gespeicherte Konto-ID unverändert.
 */
async function replaceLegacyAccount(driverId: string, existing: string, createAccount: () => Promise<string>): Promise<string> {
  const replaceable = await getPaymentProvider().isReplaceableLegacyAccount(existing, driverId).catch(() => false);
  if (!replaceable) return existing;

  const drivers = getDb().driverProfiles;
  let replacement: string;
  try {
    replacement = await createAccount();
  } catch (error) {
    // Ein paralleler Klick kann den Tausch schon vollzogen haben – dann dort weitermachen.
    const current = await drivers.get(driverId);
    if (current?.payoutAccountId && current.payoutAccountId !== existing) return current.payoutAccountId;
    await logEvent("warning", "stripe-connect", "Vorbelegtes Ersatzkonto konnte nicht angelegt werden – bisheriges Konto bleibt", {
      driverId, accountId: existing, error: errorMessage(error),
    });
    // Nicht stillschweigend ins alte Formular schicken: zwei parallele Klicks dürfen nie in
    // zwei verschiedenen Stripe-Konten landen.
    throw new ServiceError("connect_unavailable",
      "Die Einrichtung konnte gerade nicht gestartet werden. Bitte versuche es in einem Moment noch einmal.", 503);
  }
  // Nur tauschen, wenn noch das geprüfte Altkonto eingetragen ist (Mehrfachklick, zweiter Tab).
  const swapped = await drivers.updateIf(driverId, { payoutAccountId: existing }, {
    payoutAccountId: replacement, payoutReady: false, updatedAt: new Date().toISOString(),
  });
  if (swapped) {
    await logEvent("info", "stripe-connect", "Unberührtes Altkonto durch vorbelegtes Konto ersetzt", {
      driverId, replacedAccountId: existing, accountId: replacement,
    });
  }
  return (await drivers.get(driverId))?.payoutAccountId ?? existing;
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

/* ---------- Vertrag über die Trinkgeld-Funktion ---------- */

export const TIPPING_CONTRACT_ACTION = "tipping_contract_concluded";

/**
 * Die Trinkgeld-Funktion ist der entgeltliche Teil der Nutzung (Gebühr je Trinkgeld). Sie kommt
 * mit dem Klick auf „Trinkgeld zahlungspflichtig aktivieren“ zustande (§ 312j Abs. 3 BGB). Weil
 * die Leistung sofort beginnen soll, muss der Zusteller das ausdrücklich verlangen (§ 357a
 * Abs. 2 BGB). Die Vertragsbestätigung mit Widerrufsbelehrung geht vor Leistungsbeginn per
 * E-Mail raus (§ 312f Abs. 2 BGB); der Abschluss wird im Admin-Protokoll festgehalten.
 */
export async function concludeTippingContract(user: User, driver: DriverProfile, consent: { immediateStart: boolean }): Promise<void> {
  if (user.role !== "driver" || driver.userId !== user.id) {
    throw new ServiceError("forbidden", "Dieses Auszahlungskonto gehört nicht zu deinem Profil.", 403);
  }
  // Ein bestehendes Stripe-Konto heißt: Der Vertrag wurde schon geschlossen.
  if (driver.payoutAccountId) return;
  assertEmailVerified(user);
  if (!consent.immediateStart) {
    throw new ServiceError("contract_consent", "Bitte bestätige, dass die Trinkgeld-Funktion sofort beginnen soll.", 400, "immediateStart");
  }
  const db = getDb();
  if (await db.adminActions.findOne({ targetId: driver.id, action: TIPPING_CONTRACT_ACTION })) return;
  const now = new Date();
  await db.adminActions.insert({
    id: newId(),
    actorEmail: "self-service",
    targetId: driver.id,
    action: TIPPING_CONTRACT_ACTION,
    reason: "Trinkgeld-Funktion zahlungspflichtig aktiviert; Leistungsbeginn vor Ablauf der Widerrufsfrist ausdrücklich verlangt",
    createdAt: now.toISOString(),
  });
  await sendMail(user.email, emails.tippingContract(
    user.firstName, formatReceivedAt(now), `${baseUrl()}/legal/agb`, `${baseUrl()}/vertrag-widerrufen`, `${baseUrl()}/vertrag-kuendigen`,
  ), "tipping_contract");
}
