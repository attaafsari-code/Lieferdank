import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Db, Query, Table, Where } from "./table";
import { TABLE_NAMES, type TableName, type Tables } from "./types";

/**
 * Produktiver Speicher auf Supabase Postgres.
 *
 * Läuft ausschließlich serverseitig mit dem Service-Role-Key. RLS ist auf allen
 * Tabellen aktiv und verweigert per Default alles (siehe supabase/schema.sql).
 *
 * Spaltennamen werden automatisch zwischen camelCase (Code) und snake_case
 * (Postgres) übersetzt – nur auf oberster Ebene, JSON-Spalten bleiben unangetastet.
 */

let client: SupabaseClient | null = null;

export function supabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("LIEFERDANK_DB=supabase erfordert SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY.");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(\+00:00|Z)$/;

function toRow(obj: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) row[toSnake(key)] = value;
  }
  return row;
}

function fromRow<T>(row: Record<string, unknown>): T {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    // Postgres liefert "…+00:00", der Code arbeitet mit "…Z" – vereinheitlichen,
    // damit Zeitvergleiche in beiden Speichern identisch funktionieren.
    obj[toCamel(key)] =
      typeof value === "string" && ISO_WITH_OFFSET.test(value) ? new Date(value).toISOString() : value;
  }
  return obj as T;
}

function check(error: { message: string } | null, table: string): void {
  if (error) throw new Error(`Supabase (${table}): ${error.message}`);
}

const PAGE_SIZE = 1000;

function supabaseTable<N extends TableName>(name: N): Table<Tables[N]> {
  type Row = Tables[N];
  const table = toSnake(name);

  // Der Query-Builder von supabase-js ist generisch schwer zu typisieren;
  // die Schnittstelle nach außen bleibt trotzdem vollständig typisiert.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(builder: any, query: Pick<Query<Row>, "where" | "since" | "in">): any {
    let b = builder;
    for (const [key, value] of Object.entries(query.where ?? {})) {
      b = value === null ? b.is(toSnake(key), null) : b.eq(toSnake(key), value);
    }
    if (query.since) b = b.gte(toSnake(query.since.field), query.since.value);
    if (query.in) b = b.in(toSnake(query.in.field), query.in.values);
    return b;
  }

  return {
    async get(id) {
      const { data, error } = await supabaseClient().from(table).select("*").eq("id", id).maybeSingle();
      check(error, table);
      return data ? fromRow<Row>(data) : null;
    },

    async findOne(where: Where<Row>) {
      const builder = applyFilters(supabaseClient().from(table).select("*"), { where }).limit(1);
      const { data, error } = await builder;
      check(error, table);
      return data?.[0] ? fromRow<Row>(data[0]) : null;
    },

    async findMany(query: Query<Row> = {}) {
      const results: Row[] = [];
      let offset = 0;
      const limit = query.limit;

      // Supabase liefert höchstens 1000 Zeilen pro Anfrage. Ohne Limit wird
      // seitenweise gelesen – sonst würden Auswertungen still abgeschnitten.
      for (;;) {
        const pageSize = limit === undefined ? PAGE_SIZE : Math.min(PAGE_SIZE, limit - results.length);
        if (pageSize <= 0) break;

        let builder = applyFilters(supabaseClient().from(table).select("*"), query);
        if (query.orderBy) {
          builder = builder.order(toSnake(query.orderBy), { ascending: !query.desc });
        } else {
          builder = builder.order("id", { ascending: true });
        }
        const { data, error } = await builder.range(offset, offset + pageSize - 1);
        check(error, table);

        const page = (data ?? []).map((row: Record<string, unknown>) => fromRow<Row>(row));
        results.push(...page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      return results;
    },

    async count(query = {}) {
      const builder = applyFilters(
        supabaseClient().from(table).select("id", { count: "exact", head: true }),
        query,
      );
      const { count, error } = await builder;
      check(error, table);
      return count ?? 0;
    },

    async insert(row) {
      const { data, error } = await supabaseClient()
        .from(table)
        .insert(toRow(row as Record<string, unknown>))
        .select()
        .single();
      check(error, table);
      return fromRow<Row>(data);
    },

    async update(id, patch) {
      const values = toRow(patch as Record<string, unknown>);
      delete values.id;
      if (Object.keys(values).length === 0) return;
      const { error } = await supabaseClient().from(table).update(values).eq("id", id);
      check(error, table);
    },

    async remove(id) {
      const { error } = await supabaseClient().from(table).delete().eq("id", id);
      check(error, table);
    },
  };
}

export const supabaseDb: Db = Object.fromEntries(
  TABLE_NAMES.map((name) => [name, supabaseTable(name)]),
) as unknown as Db;
