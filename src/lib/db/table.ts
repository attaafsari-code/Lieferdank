import type { TableName, Tables } from "./types";

/**
 * Generischer Tabellenzugriff.
 *
 * Bewusst klein gehalten: Gleichheitsfilter, ein Zeitfilter, Sortierung, Limit.
 * Mehr braucht der MVP nicht – und genau diese Schnittstelle lässt sich für
 * Memory, Supabase oder später eine eigene API identisch implementieren.
 *
 * E-Mail-Adressen werden kleingeschrieben und Codes großgeschrieben gespeichert,
 * damit exakte Gleichheit für Lookups genügt.
 */

type Scalar = string | number | boolean | null;

export type Where<T> = { [K in keyof T]?: Extract<T[K], Scalar> };

export type Query<T> = {
  where?: Where<T>;
  /** Nur Zeilen, deren Feld >= Wert ist (ISO-Zeitstempel vergleichen korrekt). */
  since?: { field: keyof T & string; value: string };
  /** Nur Zeilen, deren Feld in der Liste enthalten ist. */
  in?: { field: keyof T & string; values: string[] };
  orderBy?: keyof T & string;
  desc?: boolean;
  limit?: number;
};

export interface Table<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  findOne(where: Where<T>): Promise<T | null>;
  findMany(query?: Query<T>): Promise<T[]>;
  count(query?: Pick<Query<T>, "where" | "since">): Promise<number>;
  insert(row: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<void>;
  /** Atomarer Zustandswechsel; false, wenn die Zeile nicht mehr im erwarteten Zustand ist. */
  updateIf(id: string, where: Where<T>, patch: Partial<T>): Promise<boolean>;
  remove(id: string): Promise<void>;
}

export type Db = { [K in TableName]: Table<Tables[K]> };

/** Prüft eine Zeile gegen eine Query – gemeinsam genutzt von Memory-Adapter und Tests. */
export function matches<T>(row: T, query: Pick<Query<T>, "where" | "since" | "in">): boolean {
  if (query.where) {
    for (const [key, value] of Object.entries(query.where)) {
      if ((row as Record<string, unknown>)[key] !== value) return false;
    }
  }
  if (query.since) {
    const value = (row as Record<string, unknown>)[query.since.field];
    if (typeof value !== "string" || value < query.since.value) return false;
  }
  if (query.in) {
    const value = (row as Record<string, unknown>)[query.in.field];
    if (typeof value !== "string" || !query.in.values.includes(value)) return false;
  }
  return true;
}
