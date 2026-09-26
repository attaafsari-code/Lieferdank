import "server-only";
import { getDb } from "@/lib/db";
import type { DriverFavorite } from "@/lib/db/types";
import { newId, normalizeCode } from "@/lib/id";
import { ServiceError, notFound } from "../errors";
import { toPublicDriver, type PublicDriver } from "./drivers";

/**
 * „Meine Lieferanten“ – gespeicherte Zusteller eines Kunden.
 * Der Zusteller erfährt davon nichts: kein Follower-Zähler, keine Kundenliste.
 */

export async function addFavoriteByCode(customerId: string, code: string): Promise<DriverFavorite> {
  const db = getDb();
  const driver = await db.driverProfiles.findOne({ code: normalizeCode(code) });
  if (!driver || !driver.active) throw notFound("Diesen Lieferanten gibt es nicht.");

  const existing = await db.driverFavorites.findOne({ customerId, driverId: driver.id });
  if (existing) return existing;

  const count = await db.driverFavorites.count({ where: { customerId } });
  if (count >= 200) throw new ServiceError("favorites_full", "Du hast bereits sehr viele Lieferanten gespeichert.", 400);

  return db.driverFavorites.insert({
    id: newId(),
    customerId,
    driverId: driver.id,
    nickname: null,
    createdAt: new Date().toISOString(),
  });
}

export async function removeFavorite(customerId: string, favoriteId: string): Promise<void> {
  const db = getDb();
  const favorite = await db.driverFavorites.get(favoriteId);
  if (!favorite || favorite.customerId !== customerId) throw notFound();
  await db.driverFavorites.remove(favorite.id);
}

export async function renameFavorite(customerId: string, favoriteId: string, nickname: string): Promise<void> {
  const db = getDb();
  const favorite = await db.driverFavorites.get(favoriteId);
  if (!favorite || favorite.customerId !== customerId) throw notFound();
  await db.driverFavorites.update(favorite.id, { nickname: nickname.trim().slice(0, 40) || null });
}

export type FavoriteView = { favoriteId: string; nickname: string | null; savedAt: string; driver: PublicDriver; active: boolean };

export async function listFavorites(customerId: string): Promise<FavoriteView[]> {
  const db = getDb();
  const favorites = await db.driverFavorites.findMany({ where: { customerId }, orderBy: "createdAt", desc: true });
  const views: FavoriteView[] = [];
  for (const favorite of favorites) {
    const driver = await db.driverProfiles.get(favorite.driverId);
    const user = driver ? await db.users.get(driver.userId) : null;
    if (!driver || !user) continue;
    views.push({
      favoriteId: favorite.id,
      nickname: favorite.nickname,
      savedAt: favorite.createdAt,
      driver: toPublicDriver(driver, user),
      active: driver.active && !user.blockedAt,
    });
  }
  return views;
}

export async function isFavorite(customerId: string, driverId: string): Promise<boolean> {
  return Boolean(await getDb().driverFavorites.findOne({ customerId, driverId }));
}

/** Verlauf eines Kunden: was er während einer Anmeldung gegeben hat. */
export async function customerHistory(customerId: string) {
  const db = getDb();
  const [thankYous, tips] = await Promise.all([
    db.thankYous.findMany({ where: { customerId }, orderBy: "createdAt", desc: true, limit: 50 }),
    db.tips.findMany({ where: { customerId, paymentStatus: "succeeded" }, orderBy: "createdAt", desc: true, limit: 50 }),
  ]);

  const drivers = new Map<string, PublicDriver>();
  for (const driverId of new Set([...thankYous.map((t) => t.driverId), ...tips.map((t) => t.driverId)])) {
    const driver = await db.driverProfiles.get(driverId);
    const user = driver ? await db.users.get(driver.userId) : null;
    if (driver && user) drivers.set(driverId, toPublicDriver(driver, user));
  }

  return {
    thankYous: thankYous.map((t) => ({ ...t, driver: drivers.get(t.driverId) ?? null })),
    totalTipCents: tips.reduce((sum, tip) => sum + tip.grossCents, 0),
    tipCount: tips.length,
  };
}
