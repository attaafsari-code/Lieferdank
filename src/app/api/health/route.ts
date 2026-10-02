import { NextResponse } from "next/server";
import { isDemoDatabase } from "@/lib/db";
import { isDemoPayment } from "@/server/payments";
import { mailConfigured } from "@/server/mail";
import { isProductionRuntime } from "@/lib/runtime";
import { supabaseClient } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

/** Für Uptime-Monitoring. Verrät keine Geheimnisse, nur welcher Modus aktiv ist. */
export async function GET() {
  const production = isProductionRuntime();
  const paymentReady = !isDemoPayment() && /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "") &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_CONNECT_WEBHOOK_SECRET &&
      process.env.STRIPE_WEBHOOK_SECRET !== process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  const databaseReady = !isDemoDatabase() && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const authReady = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
  let schemaReady = !production;
  if (production && databaseReady) {
    try {
      // Supabase prüft auch ohne Datensätze, ob die Spalten der letzten Migrationen über die API
      // erreichbar sind. Ohne payout_sync_version scheitern Registrierung und Stripe-Kontoabgleich.
      const client = supabaseClient();
      const [payments, drivers] = await Promise.all([
        client.from("payments").select("refunded_amount_cents").limit(1),
        client.from("driver_profiles").select("payout_sync_version").limit(1),
      ]);
      schemaReady = !payments.error && !drivers.error;
    } catch { schemaReady = false; }
  }
  const ready = !production || (paymentReady && databaseReady && schemaReady && authReady && mailConfigured());
  return NextResponse.json({
    ok: ready,
    database: isDemoDatabase() ? "memory" : !databaseReady ? "misconfigured" : schemaReady ? "supabase" : "migration_required",
    payments: isDemoPayment() ? "demo" : paymentReady ? "stripe" : "stripe_not_ready",
    mail: mailConfigured() ? "resend" : "log",
    time: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } });
}
