import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Store } from "./store";
import { emptyDatabase, type Database } from "./types";
import type {
  AdminAction,
  DriverProfile,
  Milestone,
  ThankYou,
  Tip,
  User,
  Verification,
} from "./types";

/**
 * Speicher fuer Demo und lokale Entwicklung.
 *
 * Persistiert nach data/db.json, wenn das Dateisystem beschreibbar ist.
 * Auf serverlosen Hosts (Vercel) ist das Dateisystem fluechtig -- dort
 * ist dieser Store ausschliesslich fuer den Demo-Modus gedacht (§81).
 * Fuer den Feldtest gehoert LIEFERDANK_DB=supabase gesetzt.
 */

const DATA_FILE = join(process.cwd(), "data", "db.json");
const canPersist = process.env.LIEFERDANK_PERSIST !== "off" && !process.env.VERCEL;

type GlobalWithDb = typeof globalThis & { __lieferdankDb?: Database };
const g = globalThis as GlobalWithDb;

function load(): Database {
  if (g.__lieferdankDb) return g.__lieferdankDb;
  let db = emptyDatabase();
  if (canPersist && existsSync(DATA_FILE)) {
    try {
      db = { ...emptyDatabase(), ...(JSON.parse(readFileSync(DATA_FILE, "utf8")) as Database) };
    } catch {
      db = emptyDatabase();
    }
  }
  g.__lieferdankDb = db;
  return db;
}

function persist(): void {
  if (!canPersist) return;
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(load(), null, 2), "utf8");
  } catch {
    // Schreibfehler duerfen die Anwendung nicht stoppen.
  }
}

function patch<T extends object>(target: T | undefined, changes: Partial<T>): void {
  if (!target) return;
  Object.assign(target, changes);
}

const clone = <T>(value: T): T => structuredClone(value);

export const memoryStore: Store = {
  async getUserByEmail(email) {
    const lower = email.toLowerCase();
    return clone(load().users.find((u) => u.email.toLowerCase() === lower) ?? null);
  },
  async getUserById(id) {
    return clone(load().users.find((u) => u.id === id) ?? null);
  },
  async createUser(user: User) {
    load().users.push(user);
    persist();
    return clone(user);
  },
  async updateUser(id, changes) {
    patch(load().users.find((u) => u.id === id), changes);
    persist();
  },
  async listUsers() {
    return clone(load().users);
  },

  async createPasswordReset(reset) {
    load().passwordResets.push(reset);
    persist();
  },
  async getPasswordResetByTokenHash(tokenHash) {
    return clone(load().passwordResets.find((r) => r.tokenHash === tokenHash) ?? null);
  },
  async markPasswordResetUsed(id) {
    patch(
      load().passwordResets.find((r) => r.id === id),
      { usedAt: new Date().toISOString() },
    );
    persist();
  },
  async invalidatePasswordResets(userId) {
    const now = new Date().toISOString();
    for (const reset of load().passwordResets) {
      if (reset.userId === userId && !reset.usedAt) reset.usedAt = now;
    }
    persist();
  },

  async getDriverById(id) {
    return clone(load().driverProfiles.find((d) => d.id === id) ?? null);
  },
  async getDriverByUserId(userId) {
    return clone(load().driverProfiles.find((d) => d.userId === userId) ?? null);
  },
  async getDriverByCode(code) {
    const upper = code.toUpperCase();
    return clone(load().driverProfiles.find((d) => d.code.toUpperCase() === upper) ?? null);
  },
  async createDriverProfile(profile: DriverProfile) {
    load().driverProfiles.push(profile);
    persist();
    return clone(profile);
  },
  async updateDriverProfile(id, changes) {
    patch(load().driverProfiles.find((d) => d.id === id), changes);
    persist();
  },
  async listDrivers() {
    return clone(load().driverProfiles);
  },

  async createTip(tip: Tip) {
    load().tips.push(tip);
    persist();
    return clone(tip);
  },
  async getTipById(id) {
    return clone(load().tips.find((t) => t.id === id) ?? null);
  },
  async getTipByProviderPaymentId(providerPaymentId) {
    return clone(load().tips.find((t) => t.providerPaymentId === providerPaymentId) ?? null);
  },
  async updateTip(id, changes) {
    patch(load().tips.find((t) => t.id === id), changes);
    persist();
  },
  async listTipsByDriver(driverId) {
    return clone(load().tips.filter((t) => t.driverId === driverId));
  },
  async listTips() {
    return clone(load().tips);
  },

  async createThankYou(thankYou: ThankYou) {
    load().thankYous.push(thankYou);
    persist();
    return clone(thankYou);
  },
  async getThankYouById(id) {
    return clone(load().thankYous.find((t) => t.id === id) ?? null);
  },
  async updateThankYou(id, changes) {
    patch(load().thankYous.find((t) => t.id === id), changes);
    persist();
  },
  async listThankYousByDriver(driverId) {
    return clone(load().thankYous.filter((t) => t.driverId === driverId));
  },
  async listThankYous() {
    return clone(load().thankYous);
  },

  async createScan(driverId, id, createdAt) {
    load().scans.push({ id, driverId, createdAt });
    persist();
  },
  async countScans(filter) {
    let scans = load().scans;
    if (filter?.driverId) scans = scans.filter((s) => s.driverId === filter.driverId);
    if (filter?.sinceIso) scans = scans.filter((s) => s.createdAt >= filter.sinceIso!);
    return scans.length;
  },

  async getVerificationByUserId(userId) {
    return clone(load().verifications.find((v) => v.userId === userId) ?? null);
  },
  async upsertVerification(verification: Verification) {
    const db = load();
    const index = db.verifications.findIndex((v) => v.userId === verification.userId);
    if (index >= 0) db.verifications[index] = verification;
    else db.verifications.push(verification);
    persist();
  },
  async listVerifications() {
    return clone(load().verifications);
  },

  async createMilestone(milestone: Milestone) {
    load().milestones.push(milestone);
    persist();
  },
  async listMilestonesByDriver(driverId) {
    return clone(load().milestones.filter((m) => m.driverId === driverId));
  },

  async createAdminAction(action: AdminAction) {
    load().adminActions.push(action);
    persist();
  },
  async listAdminActions() {
    return clone(load().adminActions);
  },
};

/** Nur fuer Seeding/Tests: ersetzt den kompletten Datenbestand. */
export function replaceDatabase(db: Database): void {
  g.__lieferdankDb = db;
  persist();
}

export function currentDatabase(): Database {
  return load();
}
