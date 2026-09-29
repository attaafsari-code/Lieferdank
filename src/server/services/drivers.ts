import "server-only";
import { getDb } from "@/lib/db";
import type { DriverProfile, User } from "@/lib/db/types";
import { initials, publicName } from "@/lib/names";
import { providerLabel } from "@/lib/providers";
import { generateLieferdankCode, newId, normalizeCode } from "@/lib/id";
import { defaultCardDesign } from "@/lib/card/design";
import { isDemoPayment } from "../payments";

/**
 * Öffentliche Sicht auf einen Zusteller. Enthält ausschließlich, was der
 * Zusteller freigegeben hat – nie E-Mail, Telefon, Stadt oder Nachname,
 * sofern der Nachname nicht Teil des gewählten Anzeigenamens ist.
 */
export type PublicDriver = {
  code: string;
  name: string;
  initials: string;
  /** Nur gesetzt, wenn ein Foto existiert UND öffentlich ist. */
  photoUrl: string | null;
  provider: string | null;
  tagline: string | null;
  bio: string | null;
  verified: boolean;
  providerVerified: boolean;
  tipReady: boolean;
};

export function avatarUrl(driver: Pick<DriverProfile, "code" | "photoKey" | "updatedAt">): string | null {
  if (!driver.photoKey) return null;
  // Versionsparameter bricht den Browser-Cache, sobald ein neues Foto hochgeladen wird.
  return `/api/media/avatar/${driver.code}?v=${encodeURIComponent(driver.updatedAt)}`;
}

export function driverPublicName(driver: DriverProfile, user: Pick<User, "firstName" | "lastName">): string {
  return publicName(user.firstName, user.lastName, driver.nameDisplay, driver.customName);
}

export function toPublicDriver(driver: DriverProfile, user: User): PublicDriver {
  const name = driverPublicName(driver, user);
  return {
    code: driver.code,
    name,
    initials: initials(name),
    photoUrl: driver.photoPublic ? avatarUrl(driver) : null,
    provider: driver.providerPublic ? providerLabel(driver.providerId) : null,
    tagline: driver.tagline,
    bio: driver.bio,
    verified: driver.verification === "verified",
    providerVerified: driver.providerVerified,
    tipReady: isDemoPayment() ? process.env.VERCEL_ENV !== "production" : driver.payoutReady,
  };
}

/** Zusteller, der gerade Danke empfangen kann – aktiv und nicht gesperrt. */
export async function findReceivingDriver(code: string): Promise<{ driver: DriverProfile; user: User } | null> {
  const db = getDb();
  const driver = await db.driverProfiles.findOne({ code: normalizeCode(code) });
  if (!driver || !driver.active) return null;
  const user = await db.users.get(driver.userId);
  if (!user || user.blockedAt) return null;
  return { driver, user };
}

export async function findDriverByCode(code: string): Promise<{ driver: DriverProfile; user: User | null } | null> {
  const db = getDb();
  const driver = await db.driverProfiles.findOne({ code: normalizeCode(code) });
  if (!driver) return null;
  return { driver, user: await db.users.get(driver.userId) };
}

/** Garantiert freier Code. Wird nur einmal bei der Registrierung vergeben. */
export async function uniqueCode(): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateLieferdankCode(attempt < 8 ? 10 : 12);
    if (!(await db.driverProfiles.findOne({ code }))) return code;
  }
  throw new Error("Es konnte kein freier Lieferdank-Code erzeugt werden.");
}

export async function createDriverProfile(userId: string, now: string): Promise<DriverProfile> {
  const db = getDb();
  const driver = await db.driverProfiles.insert({
    id: newId(),
    userId,
    code: await uniqueCode(),
    nameDisplay: "first",
    customName: null,
    photoKey: null,
    photoPublic: true,
    providerId: null,
    providerPublic: true,
    tagline: null,
    bio: null,
    city: null,
    verification: "unverified",
    providerVerified: false,
    active: true,
    payoutAccountId: null,
    payoutReady: false,
    notifyOnTip: true,
    createdAt: now,
    updatedAt: now,
  });

  try {
    await db.cardDesigns.insert({ id: newId(), driverId: driver.id, ...defaultCardDesign(), updatedAt: now });
  } catch (error) {
    await db.driverProfiles.remove(driver.id).catch(() => undefined);
    throw error;
  }
  return driver;
}
