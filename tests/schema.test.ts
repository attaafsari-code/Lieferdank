import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { Database, TableName, Tables } from "@/lib/db/types";
import { TABLE_NAMES } from "@/lib/db/types";

/**
 * Hält drei Dinge synchron: TypeScript-Typen, supabase/schema.sql und das
 * Seed-Skript. Fehlt irgendwo eine Spalte, schlägt dieser Test fehl – und nicht
 * erst die Produktion.
 *
 * Die Schlüssellisten sind per `satisfies` an die Typen gebunden: Kommt ein
 * Feld im Typ dazu, meldet TypeScript die Liste als unvollständig.
 */
type Keys<T> = Record<keyof T, true>;

const KEYS: { [K in TableName]: Keys<Tables[K]> } = {
  users: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, passwordHash: true, tokenVersion: true, createdAt: true, blockedAt: true, blockedReason: true },
  driverProfiles: {
    id: true, userId: true, code: true, nameDisplay: true, customName: true, photoKey: true, photoPublic: true, providerId: true,
    providerPublic: true, tagline: true, bio: true, city: true, verification: true, providerVerified: true, active: true,
    payoutAccountId: true, payoutReady: true, notifyOnTip: true, createdAt: true, updatedAt: true,
  },
  customerProfiles: { id: true, userId: true, createdAt: true },
  cardDesigns: { id: true, driverId: true, layout: true, headline: true, showPhoto: true, showProvider: true, updatedAt: true },
  cardOrders: {
    id: true, driverId: true, product: true, quantity: true, unitPriceCents: true, totalCents: true, currency: true, paymentStatus: true,
    paymentId: true, design: true, shippingName: true, shippingStreet: true, shippingPostalCode: true, shippingCity: true,
    shippingCountry: true, status: true, carrier: true, trackingNumber: true, reorderOf: true, createdAt: true, updatedAt: true, shippedAt: true,
  },
  payments: {
    id: true, purpose: true, referenceId: true, provider: true, providerPaymentId: true, providerIntentId: true, amountCents: true,
    currency: true, status: true, method: true, failureReason: true, createdAt: true, updatedAt: true,
  },
  tips: {
    id: true, driverId: true, paymentId: true, customerId: true, grossCents: true, driverCents: true, platformGrossFeeCents: true,
    paymentProviderFeeCents: true, payoutFeeCents: true, platformNetRevenueCents: true, currency: true, paymentStatus: true,
    payoutStatus: true, payoutId: true, destinationAccountId: true, createdAt: true,
  },
  thankYous: { id: true, driverId: true, tipId: true, customerId: true, presetId: true, message: true, createdAt: true },
  payouts: {
    id: true, driverId: true, amountCents: true, transferredCents: true, feeCents: true, status: true, provider: true,
    providerTransferId: true, tipIds: true, failureReason: true, createdAt: true, completedAt: true,
  },
  driverFavorites: { id: true, customerId: true, driverId: true, nickname: true, createdAt: true },
  verifications: { id: true, userId: true, identityStatus: true, driverStatus: true, documentNote: true, reviewNote: true, updatedAt: true },
  milestones: { id: true, driverId: true, type: true, value: true, achievedAt: true },
  adminActions: { id: true, actorEmail: true, targetId: true, action: true, reason: true, createdAt: true },
  scans: { id: true, driverId: true, createdAt: true },
  passwordResets: { id: true, userId: true, tokenHash: true, expiresAt: true, usedAt: true, createdAt: true },
  systemEvents: { id: true, level: true, source: true, message: true, context: true, createdAt: true },
};

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function schemaColumns(): Map<string, Set<string>> {
  const sql = readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf8");
  const tables = new Map<string, Set<string>>();
  for (const match of sql.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g)) {
    const columns = new Set<string>();
    for (const line of match[2].split("\n")) {
      const column = line.match(/^\s{2}([a-z_]+)\s+(uuid|text|integer|boolean|timestamptz|jsonb)\b/);
      if (column) columns.add(column[1]);
    }
    tables.set(match[1], columns);
  }
  return tables;
}

describe("Schema-Konsistenz", () => {
  const schema = schemaColumns();

  it("kennt jede Tabelle", () => {
    expect([...schema.keys()].sort()).toEqual(TABLE_NAMES.map(toSnake).sort());
  });

  it("aktiviert RLS für jede Tabelle und entzieht anon/authenticated Tabellenrechte", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf8");
    for (const name of TABLE_NAMES) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${toSnake(name)}\\s+enable row level security;`));
    }
    expect(sql).toMatch(/revoke all on all tables in schema public from anon, authenticated;/);
    expect(sql).not.toMatch(/create\s+policy\s+/i);
  });

  it.each(TABLE_NAMES)("Spalten von %s passen zum TypeScript-Typ", (name) => {
    const expected = Object.keys(KEYS[name]).map(toSnake).sort();
    expect([...(schema.get(toSnake(name)) ?? [])].sort()).toEqual(expected);
  });

  it("das Seed-Skript erzeugt Zeilen mit exakt diesen Feldern", () => {
    const dir = mkdtempSync(join(tmpdir(), "lieferdank-seed-"));
    execFileSync("node", [join(process.cwd(), "scripts", "seed.mjs")], { cwd: dir, stdio: "ignore" });
    const data = JSON.parse(readFileSync(join(dir, "data", "db.json"), "utf8")) as Database;

    for (const name of TABLE_NAMES) {
      expect(Object.keys(data), `Tabelle ${name} fehlt im Seed`).toContain(name);
      for (const row of data[name] as unknown as Record<string, unknown>[]) {
        expect(Object.keys(row).sort(), `Felder in ${name}`).toEqual(Object.keys(KEYS[name]).sort());
      }
    }
    // Die Aufteilung im Seed folgt derselben Regel wie die App.
    for (const tip of data.tips) expect(tip.driverCents + tip.platformGrossFeeCents).toBe(tip.grossCents);
  });
});
