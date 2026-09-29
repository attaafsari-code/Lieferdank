import "server-only";
import { getDb } from "@/lib/db";
import type { User } from "@/lib/db/types";
import { generateLieferdankCode, newId } from "@/lib/id";
import { ServiceError } from "../errors";

function assertAdmin(actor: User): void {
  if (actor.role !== "admin" || actor.blockedAt) throw new ServiceError("forbidden", "Nur für Administratoren.", 403);
}

/** Protokolliert jede Adminaktion – wer, was, warum. */
export async function logAdminAction(actor: User, targetId: string, action: string, reason?: string | null) {
  assertAdmin(actor);
  await getDb().adminActions.insert({
    id: newId(),
    actorEmail: actor.email,
    targetId,
    action,
    reason: reason ?? null,
    createdAt: new Date().toISOString(),
  });
}

export async function reviewBadge(actor: User, driverId: string, decision: "verified" | "rejected", note: string) {
  assertAdmin(actor);
  const db = getDb();
  const driver = await db.driverProfiles.get(driverId);
  if (!driver) throw new ServiceError("not_found", "Zusteller nicht gefunden.", 404);
  if (decision === "rejected" && !note.trim()) {
    throw new ServiceError("note_required", "Bitte begründe die Ablehnung – der Zusteller sieht den Text.", 400);
  }

  const now = new Date().toISOString();
  await db.driverProfiles.update(driver.id, { verification: decision, updatedAt: now });
  const existing = await db.verifications.findOne({ userId: driver.userId });
  const values = { identityStatus: decision, driverStatus: decision, reviewNote: note.trim() || null, updatedAt: now };
  if (existing) await db.verifications.update(existing.id, values);
  else await db.verifications.insert({ id: newId(), userId: driver.userId, documentNote: null, ...values });

  await logAdminAction(actor, driver.id, `badge_${decision}`, note);
}

export async function setProviderVerified(actor: User, driverId: string, verified: boolean) {
  assertAdmin(actor);
  await getDb().driverProfiles.update(driverId, { providerVerified: verified, updatedAt: new Date().toISOString() });
  await logAdminAction(actor, driverId, verified ? "provider_verified" : "provider_unverified");
}

export async function setUserBlocked(actor: User, userId: string, blocked: boolean, reason: string) {
  assertAdmin(actor);
  if (actor.id === userId) throw new ServiceError("self", "Du kannst dich nicht selbst sperren.", 400);
  if (blocked && !reason.trim()) throw new ServiceError("reason_required", "Bitte gib einen Grund an.", 400);

  const db = getDb();
  const user = await db.users.get(userId);
  if (!user) throw new ServiceError("not_found", "Nutzer nicht gefunden.", 404);

  await db.users.update(userId, {
    blockedAt: blocked ? new Date().toISOString() : null,
    blockedReason: blocked ? reason.trim() : null,
    // Sperre wirkt sofort: alle offenen Sessions werden ungültig.
    tokenVersion: blocked ? (user.tokenVersion ?? 0) + 1 : user.tokenVersion,
  });
  await logAdminAction(actor, userId, blocked ? "user_blocked" : "user_unblocked", reason);
}

/**
 * Neuer Code – nur bei Missbrauch (z. B. gestohlene Karte).
 * Der alte Code funktioniert danach nicht mehr, gedruckte Karten werden ungültig.
 */
export async function regenerateCode(actor: User, driverId: string, reason: string) {
  assertAdmin(actor);
  if (!reason.trim()) throw new ServiceError("reason_required", "Bitte gib einen Grund an.", 400);
  const db = getDb();
  let code = generateLieferdankCode();
  for (let attempt = 0; attempt < 12 && (await db.driverProfiles.findOne({ code })); attempt++) {
    code = generateLieferdankCode(attempt < 8 ? 10 : 12);
  }
  const driver = await db.driverProfiles.get(driverId);
  await db.driverProfiles.update(driverId, { code, updatedAt: new Date().toISOString() });
  await logAdminAction(actor, driverId, "code_regenerated", `${driver?.code ?? "?"} → ${code}: ${reason.trim()}`);
  return code;
}

/** Suche für den Support: nach E-Mail, Name oder Lieferdank-Code. */
export async function searchUsers(query: string) {
  const db = getDb();
  const [users, drivers] = await Promise.all([db.users.findMany(), db.driverProfiles.findMany()]);
  const needle = query.trim().toLowerCase();
  const driverByUser = new Map(drivers.map((d) => [d.userId, d]));

  return users
    .filter((user) => {
      if (!needle) return true;
      const driver = driverByUser.get(user.id);
      return [user.email, user.firstName, user.lastName, `${user.firstName} ${user.lastName}`, driver?.code ?? ""]
        .some((value) => value.toLowerCase().includes(needle));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((user) => ({ user, driver: driverByUser.get(user.id) ?? null }));
}
