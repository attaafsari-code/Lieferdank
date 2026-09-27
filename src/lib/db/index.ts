import "server-only";
import type { Db } from "./table";
import { memoryDb } from "./memory";
import { supabaseDb } from "./supabase";

let cached: Db | null = null;

/** Wählt den Speicher über LIEFERDANK_DB (memory | supabase). */
export function getDb(): Db {
  if (cached) return cached;
  if (process.env.VERCEL_ENV === "production" && backend() !== "supabase") {
    throw new Error("Produktivbetrieb erfordert LIEFERDANK_DB=supabase.");
  }
  if (backend() === "supabase") {
    cached = supabaseDb;
  } else {
    cached = memoryDb;
  }
  return cached;
}

function backend(): string {
  return (process.env.LIEFERDANK_DB ?? "memory").toLowerCase();
}

export function isDemoDatabase(): boolean {
  return backend() !== "supabase";
}

export type { Db, Table } from "./table";
export * from "./types";
