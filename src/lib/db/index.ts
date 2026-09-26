import "server-only";
import type { Store } from "./store";
import { memoryStore } from "./memory";

let cached: Store | null = null;

/** Waehlt den Store anhand von LIEFERDANK_DB (memory | supabase). */
export function getStore(): Store {
  if (cached) return cached;
  const backend = (process.env.LIEFERDANK_DB ?? "memory").toLowerCase();
  if (backend === "supabase") {
    // Lazy require, damit der Demo-Modus ohne Supabase-Konfiguration laeuft.
    const { supabaseStore } = require("./supabase") as typeof import("./supabase");
    cached = supabaseStore;
  } else {
    cached = memoryStore;
  }
  return cached;
}

export function isDemoDatabase(): boolean {
  return (process.env.LIEFERDANK_DB ?? "memory").toLowerCase() !== "supabase";
}

export type { Store };
export * from "./types";
