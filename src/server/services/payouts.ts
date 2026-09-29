import "server-only";
import { getDb } from "@/lib/db";
import type { DriverProfile, User } from "@/lib/db/types";
import { ServiceError } from "../errors";
import { getPaymentProvider } from "../payments";
import { baseUrl } from "../site";

/* ---------- Auszahlungskonto ---------- */

/** Startet die Einrichtung beim Zahlungsdienstleister. Dort passiert auch die Identitätsprüfung (KYC). */
export async function startPayoutOnboarding(user: User, driver: DriverProfile): Promise<string> {
  if (user.role !== "driver" || driver.userId !== user.id) {
    throw new ServiceError("forbidden", "Dieses Auszahlungskonto gehört nicht zu deinem Profil.", 403);
  }
  const provider = getPaymentProvider();
  let accountId = driver.payoutAccountId;
  if (!accountId) {
    accountId = await provider.createConnectedAccount({ email: user.email, driverId: driver.id });
    await getDb().driverProfiles.update(driver.id, { payoutAccountId: accountId, updatedAt: new Date().toISOString() });
  }
  const link = await provider.onboardDriver({
    accountId,
    driverId: driver.id,
    returnUrl: `${baseUrl()}/dashboard/einnahmen?konto=fertig`,
    refreshUrl: `${baseUrl()}/dashboard/einnahmen?konto=neu`,
  });
  return link.url;
}

export async function refreshPayoutReadiness(driver: DriverProfile): Promise<boolean> {
  if (!driver.payoutAccountId) return false;
  const ready = await getPaymentProvider().isAccountReady(driver.payoutAccountId, driver.id);
  await getDb().driverProfiles.update(driver.id, { payoutReady: ready, updatedAt: new Date().toISOString() });
  return ready;
}
