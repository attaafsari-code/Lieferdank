import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import type { DriverProfile, User } from "@/lib/db/types";
import { newId } from "@/lib/id";
import { MAX_CUSTOM_NAME_LENGTH } from "@/lib/names";
import { DELIVERY_PROVIDERS } from "@/lib/providers";
import { ServiceError } from "../errors";
import { getFile, putFile, removeFile, validatePhoto } from "../storage";

/* ---------- Profil ---------- */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .optional()
    .transform((value) => (value ? value.replace(/\s+/g, " ") : null));

export const profileSchema = z
  .object({
    firstName: z.string().trim().min(1, "Bitte gib deinen Vornamen an.").max(60),
    lastName: z.string().trim().min(1, "Bitte gib deinen Nachnamen an.").max(60),
    nameDisplay: z.enum(["first", "last", "first_initial", "full", "custom"]),
    customName: optionalText(MAX_CUSTOM_NAME_LENGTH),
    providerId: z
      .string()
      .optional()
      .transform((value) => (value && DELIVERY_PROVIDERS.some((p) => p.id === value) ? value : null)),
    providerPublic: z.boolean(),
    tagline: optionalText(80),
    bio: optionalText(280),
    city: optionalText(60),
    phone: optionalText(40),
    notifyOnTip: z.boolean(),
  })
  .refine((data) => data.nameDisplay !== "custom" || Boolean(data.customName), {
    path: ["customName"],
    message: "Bitte gib deinen Anzeigenamen ein.",
  });

export type ProfileInput = z.infer<typeof profileSchema>;

export async function updateDriverProfile(user: User, driver: DriverProfile, input: ProfileInput): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  await db.users.update(user.id, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
  });

  await db.driverProfiles.update(driver.id, {
    nameDisplay: input.nameDisplay,
    customName: input.customName,
    providerId: input.providerId,
    providerPublic: input.providerPublic,
    // Eine geänderte Anbieterangabe gilt wieder als ungeprüft.
    providerVerified: input.providerId === driver.providerId ? driver.providerVerified : false,
    tagline: input.tagline,
    bio: input.bio,
    city: input.city,
    notifyOnTip: input.notifyOnTip,
    updatedAt: now,
  });
}

/* ---------- Foto ---------- */

export async function uploadDriverPhoto(driver: DriverProfile, bytes: Uint8Array): Promise<void> {
  const contentType = validatePhoto(bytes);
  // Zufälliger Schlüssel: kein Rückschluss auf die Person, alte Dateien sind nicht erratbar.
  const key = `avatars/${driver.id}/${newId()}`;
  await putFile(key, bytes, contentType);

  const previous = driver.photoKey;
  await getDb().driverProfiles.update(driver.id, { photoKey: key, updatedAt: new Date().toISOString() });
  if (previous) await removeFile(previous).catch(() => undefined);
}

/** Foto öffentlich oder nur im eigenen Dashboard sichtbar. */
export async function setPhotoPublic(driver: DriverProfile, photoPublic: boolean): Promise<void> {
  await getDb().driverProfiles.update(driver.id, { photoPublic, updatedAt: new Date().toISOString() });
}

export async function removeDriverPhoto(driver: DriverProfile): Promise<void> {
  if (!driver.photoKey) return;
  await getDb().driverProfiles.update(driver.id, { photoKey: null, updatedAt: new Date().toISOString() });
  await removeFile(driver.photoKey).catch(() => undefined);
}

export async function readDriverPhoto(driver: DriverProfile) {
  return driver.photoKey ? getFile(driver.photoKey) : null;
}

/* ---------- Sichtbarkeit, Abzeichen, Konto ---------- */

export async function setDriverActive(driver: DriverProfile, active: boolean): Promise<void> {
  await getDb().driverProfiles.update(driver.id, { active, updatedAt: new Date().toISOString() });
}

export async function requestBadge(user: User, driver: DriverProfile, note: string): Promise<void> {
  const trimmed = note.trim();
  if (trimmed.length < 10) {
    throw new ServiceError("note_short", "Bitte beschreibe kurz, wie wir deine Tätigkeit nachvollziehen können.", 400, "documentNote");
  }
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await db.verifications.findOne({ userId: user.id });
  const values = {
    identityStatus: "pending" as const,
    driverStatus: "pending" as const,
    documentNote: trimmed.slice(0, 500),
    updatedAt: now,
  };
  if (existing) await db.verifications.update(existing.id, values);
  else await db.verifications.insert({ id: newId(), userId: user.id, reviewNote: null, ...values });
  await db.driverProfiles.update(driver.id, { verification: "pending", updatedAt: now });
}

/**
 * DSGVO-Löschung. Zahlungsdatensätze bleiben aus buchhalterischen Gründen,
 * verlieren aber jeden Personenbezug. Der Code wird deaktiviert, nie neu vergeben.
 */
export async function deleteAccount(user: User): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  const driver = await db.driverProfiles.findOne({ userId: user.id });
  if (driver) {
    if (driver.photoKey) await removeFile(driver.photoKey).catch(() => undefined);
    await db.driverProfiles.update(driver.id, {
      nameDisplay: "custom",
      customName: "Gelöschtes Profil",
      photoKey: null,
      providerId: null,
      tagline: null,
      bio: null,
      city: null,
      active: false,
      payoutAccountId: null,
      payoutReady: false,
      updatedAt: now,
    });
  }

  if (user.role === "customer") {
    for (const favorite of await db.driverFavorites.findMany({ where: { customerId: user.id } })) {
      await db.driverFavorites.remove(favorite.id);
    }
  }

  await db.users.update(user.id, {
    firstName: "Gelöscht",
    lastName: "",
    email: `geloescht+${user.id}@lieferdank.invalid`,
    phone: null,
    passwordHash: "geloescht",
    tokenVersion: (user.tokenVersion ?? 0) + 1,
    blockedAt: now,
    blockedReason: "Vom Nutzer gelöscht",
  });

  await db.adminActions.insert({
    id: newId(),
    actorEmail: "self-service",
    targetId: user.id,
    action: "account_deleted",
    reason: "DSGVO-Löschung durch den Nutzer",
    createdAt: now,
  });
}

/** Alle personenbezogenen Daten eines Kontos, ohne Passwort-Hash. */
export async function exportUserData(user: User) {
  const db = getDb();
  const driver = await db.driverProfiles.findOne({ userId: user.id });
  const { passwordHash: _hash, tokenVersion: _version, ...account } = user;

  if (driver) {
    const [tips, thankYous, milestones, payouts, cardOrders, cardDesign, verification] = await Promise.all([
      db.tips.findMany({ where: { driverId: driver.id } }),
      db.thankYous.findMany({ where: { driverId: driver.id } }),
      db.milestones.findMany({ where: { driverId: driver.id } }),
      db.payouts.findMany({ where: { driverId: driver.id } }),
      db.cardOrders.findMany({ where: { driverId: driver.id } }),
      db.cardDesigns.findOne({ driverId: driver.id }),
      db.verifications.findOne({ userId: user.id }),
    ]);
    // Kundenbezug entfernen – der Zusteller darf nie erfahren, wer gegeben hat.
    const strip = <T extends { customerId: string | null }>(rows: T[]) => rows.map((r) => ({ ...r, customerId: null }));
    return {
      exportiertAm: new Date().toISOString(),
      konto: account,
      zustellerProfil: driver,
      karte: cardDesign,
      kartenbestellungen: cardOrders,
      vertrauensabzeichen: verification,
      trinkgelder: strip(tips),
      danke: strip(thankYous),
      auszahlungen: payouts,
      meilensteine: milestones,
    };
  }

  const [favorites, thankYous, tips] = await Promise.all([
    db.driverFavorites.findMany({ where: { customerId: user.id } }),
    db.thankYous.findMany({ where: { customerId: user.id } }),
    db.tips.findMany({ where: { customerId: user.id } }),
  ]);
  return {
    exportiertAm: new Date().toISOString(),
    konto: account,
    gespeicherteLieferanten: favorites,
    gesendeteDanke: thankYous.map(({ id, presetId, message, createdAt }) => ({ id, presetId, message, createdAt })),
    gegebeneTrinkgelder: tips.map(({ id, grossCents, paymentStatus, createdAt }) => ({ id, grossCents, paymentStatus, createdAt })),
  };
}
