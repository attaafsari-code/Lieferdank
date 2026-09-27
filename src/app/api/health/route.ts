import { NextResponse } from "next/server";
import { isDemoDatabase } from "@/lib/db";
import { isDemoPayment } from "@/server/payments";
import { mailConfigured } from "@/server/mail";

export const dynamic = "force-dynamic";

/** Für Uptime-Monitoring. Verrät keine Geheimnisse, nur welcher Modus aktiv ist. */
export function GET() {
  const production = process.env.VERCEL_ENV === "production";
  const paymentReady = !isDemoPayment() && /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "") &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  const databaseReady = !isDemoDatabase() && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const authReady = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
  const ready = !production || (paymentReady && databaseReady && authReady && mailConfigured());
  return NextResponse.json({
    ok: ready,
    database: isDemoDatabase() ? "memory" : "supabase",
    payments: isDemoPayment() ? "demo" : "stripe",
    mail: mailConfigured() ? "resend" : "log",
    time: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } });
}
