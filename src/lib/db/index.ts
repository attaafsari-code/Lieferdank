import "server-only";
import type { Db } from "./table";
import { memoryDb } from "./memory";
import { supabaseDb } from "./supabase";
import { isProductionRuntime } from "@/lib/runtime";

let cached: Db | null = null;

/** Wählt den Speicher über LIEFERDANK_DB (memory | supabase). */
export function getDb(): Db {
  if (process.env.VERCEL_ENV === "preview" && backend() === "supabase" &&
      process.env.ALLOW_PREVIEW_SUPABASE_TEST_PROJECT !== "true") {
    throw new Error("Preview benötigt ein ausdrücklich freigegebenes separates Supabase-Testprojekt.");
  }
  if (cached) return cached;
  if (isProductionRuntime() && backend() !== "supabase") {
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
