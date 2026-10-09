import { NextResponse } from "next/server";
import { isDemoDatabase } from "@/lib/db";
import { isDemoPayment } from "@/server/payments";
import { mailConfigured } from "@/server/mail";
import { isProductionRuntime } from "@/lib/runtime";
import { supabaseClient } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

type SchemaState = "ready" | "migration_required" | "unavailable";

/**
 * Supabase prüft auch ohne Datensätze, ob die Spalten der letzten Migrationen über die API
 * erreichbar sind. Ohne payout_sync_version scheitern Registrierung und Stripe-Kontoabgleich,
 * ohne die Erstattungsspalten der tips lassen sich keine Trinkgelder anlegen, ohne
 * email_verified_at keine Konten.
 */
const SCHEMA_CHECKS = [
  ["payments", "refunded_amount_cents"],
  ["driver_profiles", "payout_sync_version"],
  ["tips", "refunded_cents, fee_refunded_cents"],
  ["users", "email_verified_at"],
] as const;

/** Nur diese Fehler bedeuten „Spalte bzw. Tabelle fehlt“ – alles andere ist eine Störung. */
const MISSING_SCHEMA = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);

type CheckError = { code?: string; message?: string } | null;

async function checkSchemaOnce(): Promise<{ state: SchemaState; errors: { table: string; code: string; message: string }[] }> {
  const client = supabaseClient();
  const results = await Promise.all([...SCHEMA_CHECKS, ...(process.env.DRIVER_APP_ENABLED === "true" ? [["mobile_sessions", "token_version, expires_at, revoked_at, push_token"], ["push_deliveries", "session_id, event_key, status, ticket_id"]] : [])].map(async ([table, columns]) => {
    try {
      const { error } = await client.from(table).select(columns).limit(1);
      return { table, error: error as CheckError };
    } catch (error) {
      return { table, error: { code: "fetch_failed", message: error instanceof Error ? error.message : "Unbekannter Fehler" } };
    }
  }));
  const errors = results.filter((result) => result.error).map(({ table, error }) => ({
    table, code: String(error?.code ?? "unknown"), message: String(error?.message ?? "").slice(0, 200),
  }));
  if (errors.length === 0) return { state: "ready", errors };
  return { state: errors.some((error) => MISSING_SCHEMA.has(error.code)) ? "migration_required" : "unavailable", errors };
}

/**
 * Eine kurze Störung (z. B. der erste Aufruf eines frisch gestarteten Deployments) wird einmal
 * wiederholt, statt als fehlende Migration gemeldet zu werden.
 */
async function checkSchema(): Promise<SchemaState> {
  let result = await checkSchemaOnce();
  if (result.state === "unavailable") {
    await new Promise((resolve) => setTimeout(resolve, 300));
    result = await checkSchemaOnce();
  }
  // Ins Laufzeitlog: Tabelle, Fehlercode und Meldung – keine Zugangsdaten.
  if (result.state !== "ready") console.error("[health] Datenbankprüfung fehlgeschlagen", result.state, result.errors);
  return result.state;
}

/** Für Uptime-Monitoring. Verrät keine Geheimnisse, nur welcher Modus aktiv ist. */
export async function GET() {
  const production = isProductionRuntime();
  const paymentReady = !isDemoPayment() && /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "") &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_CONNECT_WEBHOOK_SECRET &&
      process.env.STRIPE_WEBHOOK_SECRET !== process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  const databaseReady = !isDemoDatabase() && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const authReady = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
  const schema: SchemaState = production && databaseReady ? await checkSchema() : production ? "unavailable" : "ready";
  const ready = !production || (paymentReady && databaseReady && schema === "ready" && authReady && mailConfigured());
  return NextResponse.json({
    ok: ready,
    database: isDemoDatabase() ? "memory" : !databaseReady ? "misconfigured" : schema === "ready" ? "supabase" : schema,
    payments: isDemoPayment() ? "demo" : paymentReady ? "stripe" : "stripe_not_ready",
    mail: mailConfigured() ? "resend" : "log",
    // Nur ob AUTH_SECRET ausreichend lang gesetzt ist – nie der Wert.
    auth: authReady ? "configured" : "missing",
    time: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } });
}
