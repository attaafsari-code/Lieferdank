import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { matches, type Db, type Query, type Table, type Where } from "./table";
import { emptyDatabase, TABLE_NAMES, type Database, type TableName, type Tables } from "./types";

/**
 * Testspeicher für Demo und lokale Entwicklung.
 *
 * Persistiert nach data/db.json. Auf serverlosen Hosts ist das Dateisystem
 * flüchtig – dort ist dieser Speicher nur für Vorführungen geeignet.
 */

const DATA_FILE = join(process.cwd(), "data", "db.json");
const canPersist = process.env.LIEFERDANK_PERSIST !== "off" && !process.env.VERCEL;

type GlobalWithDb = typeof globalThis & { __lieferdankDb?: Database };
const g = globalThis as GlobalWithDb;

function load(): Database {
  if (g.__lieferdankDb) return g.__lieferdankDb;
  const db = emptyDatabase();
  if (canPersist && existsSync(DATA_FILE)) {
    try {
      const stored = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<Database>;
      for (const name of TABLE_NAMES) {
        if (Array.isArray(stored[name])) (db as Record<string, unknown[]>)[name] = stored[name]!;
      }
    } catch {
      // Beschädigte Datei: mit leerem Bestand starten statt abzustürzen.
    }
  }
  // Ältere lokale Dateien kennen die Spalte noch nicht; Postgres füllt sie per Default mit 0.
  for (const driver of db.driverProfiles) driver.payoutSyncVersion ??= 0;
  for (const user of db.users) user.emailVerifiedAt ??= null;
  for (const tip of db.tips) {
    tip.refundedCents ??= 0;
    tip.feeRefundedCents ??= 0;
  }
  g.__lieferdankDb = db;
  return db;
}

function persist(): void {
  if (!canPersist) return;
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    // Erst in eine Temp-Datei schreiben, dann umbenennen: nie eine halbe Datei.
    const tmp = `${DATA_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(load(), null, 2), "utf8");
    renameSync(tmp, DATA_FILE);
  } catch {
    // Schreibfehler dürfen die Anwendung nicht stoppen.
  }
}

const clone = <T>(value: T): T => structuredClone(value);

function memoryTable<N extends TableName>(name: N): Table<Tables[N]> {
  type Row = Tables[N];
  const rows = () => load()[name] as Row[];

  return {
    async get(id) {
      return clone(rows().find((row) => row.id === id) ?? null);
    },
    async findOne(where: Where<Row>) {
      return clone(rows().find((row) => matches(row, { where })) ?? null);
    },
    async findMany(query: Query<Row> = {}) {
      let result = rows().filter((row) => matches(row, query));
      if (query.orderBy) {
        const key = query.orderBy;
        const dir = query.desc ? -1 : 1;
        result = [...result].sort((a, b) => {
          const av = a[key] as unknown as string | number;
          const bv = b[key] as unknown as string | number;
          return av < bv ? -dir : av > bv ? dir : 0;
        });
      }
      if (query.limit !== undefined) result = result.slice(0, query.limit);
      return clone(result);
    },
    async count(query = {}) {
      return rows().filter((row) => matches(row, query)).length;
    },
    async insert(row) {
      if (rows().some((existing) => existing.id === row.id)) {
        throw new Error(`${name}: Zeile ${row.id} existiert bereits`);
      }
      if (name === "payouts" && rows().some((existing) =>
        (existing as unknown as { driverId: string; status: string }).driverId === (row as unknown as { driverId: string }).driverId &&
        (existing as unknown as { status: string }).status === "pending")) {
        throw new Error("payouts: offene Auszahlung für diesen Zusteller existiert bereits");
      }
      if (name === "thankYous") {
        const incoming = row as unknown as { driverId: string; tipId: string | null; freeDay?: string | null; visitorHash?: string | null; customerId: string | null };
        if (!incoming.tipId && incoming.freeDay && rows().some((existing) => {
          const previous = existing as typeof incoming;
          return !previous.tipId && previous.driverId === incoming.driverId && previous.freeDay === incoming.freeDay &&
            (Boolean(incoming.visitorHash && previous.visitorHash === incoming.visitorHash) ||
              Boolean(incoming.customerId && previous.customerId === incoming.customerId));
        })) {
          throw new Error("thank_yous_free_daily_visitor_idx: Danke für diesen Tag existiert bereits");
        }
      }
      rows().push(clone(row));
      persist();
      return clone(row);
    },
    async update(id, patch) {
      const row = rows().find((existing) => existing.id === id);
      if (row) {
        Object.assign(row, clone(patch));
        persist();
      }
    },
    async updateIf(id, where, patch) {
      const row = rows().find((existing) => existing.id === id && matches(existing, { where }));
      if (!row) return false;
      Object.assign(row, clone(patch));
      persist();
      return true;
    },
    async remove(id) {
      const list = rows();
      const index = list.findIndex((row) => row.id === id);
      if (index >= 0) {
        list.splice(index, 1);
        persist();
      }
    },
  };
}

export const memoryDb: Db = Object.fromEntries(
  TABLE_NAMES.map((name) => [name, memoryTable(name)]),
) as unknown as Db;

/** Nur für Seeding und Tests: ersetzt den kompletten Bestand. */
export function replaceMemoryDatabase(db: Database): void {
  g.__lieferdankDb = db;
  persist();
}

export function resetMemoryDatabase(): void {
  g.__lieferdankDb = emptyDatabase();
}
